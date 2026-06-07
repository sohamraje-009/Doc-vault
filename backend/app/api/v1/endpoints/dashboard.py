from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.department import Department
from app.models.document import Document
from app.models.download_history import DownloadHistory
from app.models.user import User, UserRole
from app.schemas.document import ActivityLogResponse, DashboardStats, DownloadHistoryResponse, DocumentResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _restrict_documents_for_user(query, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return query
    if not current_user.department_id:
        return query.filter(False)
    return query.filter(Document.department_id == current_user.department_id)


def _restrict_downloads_for_user(query, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return query
    if not current_user.department_id:
        return query.filter(False)
    return query.filter(DownloadHistory.department_id == current_user.department_id)


def _doc(document: Document) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        title=document.title,
        description=document.description,
        file_name=document.file_name,
        file_type=document.file_type,
        file_size=document.file_size,
        department_id=document.department_id,
        department_name=document.department.name if document.department else "Unassigned",
        uploaded_by_id=document.uploaded_by_id,
        uploaded_by_name=document.uploaded_by.full_name if document.uploaded_by else None,
        tags=[tag.tag for tag in document.tags],
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.get("", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> DashboardStats:
    department_counts_query = db.query(Department.name, func.count(Document.id)).outerjoin(Document)
    if current_user.role != UserRole.ADMIN:
        department_counts_query = department_counts_query.filter(Department.id == current_user.department_id)
    documents_by_department = [
        {"name": name, "value": count}
        for name, count in department_counts_query.group_by(Department.id, Department.name).order_by(Department.name).all()
    ]

    uploads: dict[str, int] = {}
    for created_at in _restrict_documents_for_user(db.query(Document.created_at), current_user).all():
        month = created_at[0].strftime("%Y-%m")
        uploads[month] = uploads.get(month, 0) + 1
    downloads: dict[str, int] = {}
    for downloaded_at in _restrict_downloads_for_user(db.query(DownloadHistory.downloaded_at), current_user).all():
        month = downloaded_at[0].strftime("%Y-%m")
        downloads[month] = downloads.get(month, 0) + 1

    recent_activity = db.query(ActivityLog).options(joinedload(ActivityLog.user)).order_by(ActivityLog.created_at.desc()).limit(8).all()
    recent_uploads = _restrict_documents_for_user(
        db.query(Document).options(joinedload(Document.department), joinedload(Document.uploaded_by), joinedload(Document.tags)),
        current_user,
    ).order_by(Document.created_at.desc()).limit(6).all()
    recent_downloads = _restrict_downloads_for_user(
        db.query(DownloadHistory).options(joinedload(DownloadHistory.user), joinedload(DownloadHistory.document), joinedload(DownloadHistory.department)),
        current_user,
    ).order_by(DownloadHistory.downloaded_at.desc()).limit(6).all()

    return DashboardStats(
        total_documents=_restrict_documents_for_user(db.query(func.count(Document.id)), current_user).scalar() or 0,
        total_downloads=_restrict_downloads_for_user(db.query(func.count(DownloadHistory.id)), current_user).scalar() or 0,
        total_departments=db.query(func.count(Department.id)).scalar() or 0,
        total_users=db.query(func.count(User.id)).scalar() or 0,
        documents_by_department=documents_by_department,
        monthly_uploads=[{"month": month, "value": value} for month, value in sorted(uploads.items())],
        monthly_downloads=[{"month": month, "value": value} for month, value in sorted(downloads.items())],
        recent_activity=[
            ActivityLogResponse(id=item.id, user_id=item.user_id, user_name=item.user.full_name if item.user else None, action=item.action.value, entity_type=item.entity_type, entity_id=item.entity_id, details=item.details, ip_address=item.ip_address, created_at=item.created_at)
            for item in recent_activity
        ],
        recent_uploads=[_doc(item) for item in recent_uploads],
        recent_downloads=[
            DownloadHistoryResponse(id=item.id, user_id=item.user_id, user_name=item.user.full_name if item.user else None, document_id=item.document_id, document_name=item.document.title if item.document else "Deleted document", department_id=item.department_id, department_name=item.department.name if item.department else None, ip_address=item.ip_address, downloaded_at=item.downloaded_at)
            for item in recent_downloads
        ],
    )
