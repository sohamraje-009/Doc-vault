from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_client_ip, get_current_user
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import (
    login_user,
    logout_user,
    refresh_access_token,
    request_password_reset,
    reset_password,
    user_to_response,
)
from app.core.security import get_password_hash, verify_password
from app.models.activity_log import ActivityAction
from app.services.activity_service import log_activity
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    tokens, _ = login_user(db, payload, ip_address=get_client_ip(request))
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: TokenRefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return refresh_access_token(db, payload.refresh_token)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    sent_email = request_password_reset(db, payload.identifier)
    if sent_email is False:
        return ForgotPasswordResponse(
            message="SMTP is not configured, so the reset code was saved to password_reset_outbox.log.",
        )
    return ForgotPasswordResponse(message="Reset code sent to your email.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_user_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    reset_password(db, payload.code, payload.new_password, ip_address=get_client_ip(request))
    return MessageResponse(message="Password reset successfully")


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    logout_user(db, current_user, ip_address=get_client_ip(request))
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = (
        db.query(User)
        .options(joinedload(User.department))
        .filter(User.id == current_user.id)
        .first()
    )
    return user_to_response(user)  # type: ignore[arg-type]


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    duplicate = (
        db.query(User)
        .filter(User.email == payload.email.lower(), User.id != current_user.id)
        .first()
    )
    if duplicate:
        from fastapi import HTTPException

        raise HTTPException(status_code=409, detail="Email already exists")

    current_user.full_name = payload.full_name.strip()
    current_user.email = payload.email.lower()
    current_user.phone_number = payload.phone_number.strip() if payload.phone_number else None
    current_user.profile_picture = payload.profile_picture
    db.commit()
    db.refresh(current_user)
    log_activity(
        db,
        action=ActivityAction.USER_UPDATE,
        user_id=current_user.id,
        entity_type="user",
        entity_id=str(current_user.id),
        details=f"Updated profile for {current_user.username}",
        ip_address=get_client_ip(request),
    )
    user = (
        db.query(User)
        .options(joinedload(User.department))
        .filter(User.id == current_user.id)
        .first()
    )
    return user_to_response(user)  # type: ignore[arg-type]


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    from fastapi import HTTPException

    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")
    if payload.current_password.strip() == payload.new_password.strip():
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    if not verify_password(payload.current_password.strip(), current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = get_password_hash(payload.new_password.strip())
    db.commit()
    log_activity(
        db,
        action=ActivityAction.USER_UPDATE,
        user_id=current_user.id,
        entity_type="user",
        entity_id=str(current_user.id),
        details=f"Changed password for {current_user.username}",
        ip_address=get_client_ip(request),
    )
    return MessageResponse(message="Password changed successfully")
