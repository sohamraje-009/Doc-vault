from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_client_ip, require_admin
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.activity_log import ActivityAction
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import MessageResponse
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.activity_service import log_activity
from app.services.auth_service import user_to_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[UserResponse]:
    query = db.query(User).options(joinedload(User.department))
    if search:
        needle = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(needle), User.username.ilike(needle), User.email.ilike(needle)))
    return [user_to_response(user) for user in query.order_by(User.full_name).all()]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserResponse:
    email = payload.email.strip().lower()
    username = payload.username.strip()
    full_name = payload.full_name.strip()
    if payload.role not in {role.value for role in UserRole}:
        raise HTTPException(status_code=400, detail="Invalid role")
    exists = db.query(User).filter(or_(User.username == username, User.email == email)).first()
    if exists:
        raise HTTPException(status_code=409, detail="Username or email already exists")
    user = User(
        email=email,
        username=username,
        full_name=full_name,
        hashed_password=get_password_hash(payload.password.strip()),
        role=UserRole(payload.role),
        status=UserStatus.ACTIVE,
        department_id=payload.department_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, action=ActivityAction.USER_CREATE, user_id=current_user.id, entity_type="user", entity_id=str(user.id), details=f"Created user {user.username}", ip_address=get_client_ip(request))
    user = db.query(User).options(joinedload(User.department)).filter(User.id == user.id).first()
    return user_to_response(user)  # type: ignore[arg-type]


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = payload.model_dump(exclude_unset=True)
    if user_id == current_user.id and updates.get("status") == UserStatus.INACTIVE.value:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if "password" in updates and updates["password"]:
        user.hashed_password = get_password_hash(updates.pop("password"))
    for key, value in updates.items():
        if key == "role" and value is not None:
            value = UserRole(value)
        if key == "status" and value is not None:
            value = UserStatus(value)
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    log_activity(db, action=ActivityAction.USER_UPDATE, user_id=current_user.id, entity_type="user", entity_id=str(user.id), details=f"Updated user {user.username}", ip_address=get_client_ip(request))
    user = db.query(User).options(joinedload(User.department)).filter(User.id == user.id).first()
    return user_to_response(user)  # type: ignore[arg-type]


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MessageResponse:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    username = user.username
    db.delete(user)
    db.commit()
    log_activity(db, action=ActivityAction.USER_DELETE, user_id=current_user.id, entity_type="user", entity_id=str(user_id), details=f"Deleted user {username}", ip_address=get_client_ip(request))
    return MessageResponse(message="User deleted")
