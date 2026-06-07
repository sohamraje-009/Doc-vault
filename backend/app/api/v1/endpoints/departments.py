from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_client_ip, get_current_user, require_admin
from app.db.session import get_db
from app.models.activity_log import ActivityAction
from app.models.department import Department
from app.models.document import Document
from app.models.download_history import DownloadHistory
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate, MessageResponse
from app.services.activity_service import log_activity

router = APIRouter(prefix="/departments", tags=["Departments"])


def _stats(db: Session, department: Department) -> dict:
    return {
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "total_documents": db.query(func.count(Document.id)).filter(Document.department_id == department.id).scalar() or 0,
        "total_users": db.query(func.count(User.id)).filter(User.department_id == department.id).scalar() or 0,
        "total_downloads": db.query(func.count(DownloadHistory.id)).filter(DownloadHistory.department_id == department.id).scalar() or 0,
    }


@router.get("")
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Department)
    if current_user.role != UserRole.ADMIN:
        if not current_user.department_id:
            return []
        query = query.filter(Department.id == current_user.department_id)
    departments = query.order_by(Department.name).all()
    return [_stats(db, department) for department in departments]


@router.post("", response_model=DepartmentResponse, status_code=201)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> DepartmentResponse:
    name = payload.name.strip()
    description = payload.description.strip() if payload.description else None
    if db.query(Department).filter(func.lower(Department.name) == name.lower()).first():
        raise HTTPException(status_code=409, detail="Department already exists")
    department = Department(name=name, description=description)
    db.add(department)
    db.commit()
    db.refresh(department)
    log_activity(db, action=ActivityAction.DEPARTMENT_CREATE, user_id=current_user.id, entity_type="department", entity_id=str(department.id), details=f"Created department {department.name}", ip_address=get_client_ip(request))
    return department


@router.patch("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: UUID,
    payload: DepartmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> DepartmentResponse:
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(department, key, value)
    db.commit()
    db.refresh(department)
    log_activity(db, action=ActivityAction.DEPARTMENT_UPDATE, user_id=current_user.id, entity_type="department", entity_id=str(department.id), details=f"Updated department {department.name}", ip_address=get_client_ip(request))
    return department


@router.delete("/{department_id}", response_model=MessageResponse)
def delete_department(
    department_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MessageResponse:
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.documents:
        raise HTTPException(status_code=409, detail="Cannot delete a department with documents")
    name = department.name
    db.delete(department)
    db.commit()
    log_activity(db, action=ActivityAction.DEPARTMENT_DELETE, user_id=current_user.id, entity_type="department", entity_id=str(department_id), details=f"Deleted department {name}", ip_address=get_client_ip(request))
    return MessageResponse(message="Department deleted")
