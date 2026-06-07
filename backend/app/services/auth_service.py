from datetime import UTC, datetime, timedelta
import secrets

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.password_reset import PasswordResetCode
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.activity_service import log_activity
from app.services.email_service import send_password_reset_email
from app.models.activity_log import ActivityAction

settings = get_settings()
DEFAULT_ADMIN_EMAIL = "itsupport@maso-group.com"
DEFAULT_ADMIN_USERNAME = "itsupport@maso-group.com"
DEFAULT_ADMIN_PASSWORD = "dfcncit@123"
PASSWORD_RESET_EXPIRE_MINUTES = 15


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    username = username.strip()
    normalized = username.lower()
    password = password.strip()
    user = (
        db.query(User)
        .options(joinedload(User.department))
        .filter((User.username == username) | (User.email == normalized))
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def build_token_response(user: User, remember_me: bool = False) -> TokenResponse:
    access_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    if remember_me:
        access_delta = timedelta(days=7)

    return TokenResponse(
        access_token=create_access_token(user.id, expires_delta=access_delta),
        refresh_token=create_refresh_token(user.id),
    )


def login_user(
    db: Session,
    payload: LoginRequest,
    ip_address: str | None = None,
) -> tuple[TokenResponse, User]:
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your administrator.",
        )

    tokens = build_token_response(user, remember_me=payload.remember_me)
    log_activity(
        db,
        action=ActivityAction.LOGIN,
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        details=f"User {user.username} logged in",
        ip_address=ip_address,
    )
    return tokens, user


def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


def _generate_reset_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def request_password_reset(db: Session, identifier: str) -> bool | None:
    normalized = identifier.strip().lower()
    user = (
        db.query(User)
        .filter((User.username == identifier.strip()) | (User.email == normalized))
        .first()
    )
    if not user or user.status != UserStatus.ACTIVE:
        return None

    now = datetime.now(UTC)
    code = _generate_reset_code()
    (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))
        .update({"used_at": now}, synchronize_session=False)
    )
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=get_password_hash(code),
            expires_at=now + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    db.commit()
    return send_password_reset_email(user.email, code)


def reset_password(db: Session, code: str, new_password: str, ip_address: str | None = None) -> None:
    now = datetime.now(UTC)
    reset_codes = (
        db.query(PasswordResetCode)
        .options(joinedload(PasswordResetCode.user))
        .filter(PasswordResetCode.used_at.is_(None))
        .all()
    )
    reset_code = next(
        (
            item
            for item in reset_codes
            if _as_aware_utc(item.expires_at) > now and verify_password(code.strip(), item.code_hash)
        ),
        None,
    )
    if not reset_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code")

    user = reset_code.user
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found or inactive")

    user.hashed_password = get_password_hash(new_password.strip())
    reset_code.used_at = now
    db.commit()
    log_activity(
        db,
        action=ActivityAction.USER_UPDATE,
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        details=f"Password reset for user {user.username}",
        ip_address=ip_address,
    )


def logout_user(db: Session, user: User, ip_address: str | None = None) -> None:
    log_activity(
        db,
        action=ActivityAction.LOGOUT,
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        details=f"User {user.username} logged out",
        ip_address=ip_address,
    )


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        status=user.status.value,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        phone_number=user.phone_number,
        profile_picture=user.profile_picture,
    )


def _ensure_default_user(
    db: Session,
    *,
    email: str,
    username: str,
    password: str,
    full_name: str,
    role: UserRole,
    legacy_username: str | None = None,
) -> User:
    existing = (
        db.query(User)
        .filter((User.username == username) | (User.email == email) | (User.username == legacy_username))
        .first()
    )
    if existing:
        existing.email = email
        existing.username = username
        existing.full_name = full_name
        existing.role = role
        existing.status = UserStatus.ACTIVE
        db.commit()
        db.refresh(existing)
        return existing

    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_default_admin(db: Session) -> User | None:
    return _ensure_default_user(
        db,
        email=DEFAULT_ADMIN_EMAIL,
        username=DEFAULT_ADMIN_USERNAME,
        password=DEFAULT_ADMIN_PASSWORD,
        full_name="Rameshwar Dakle",
        role=UserRole.ADMIN,
        legacy_username="admin",
    )
