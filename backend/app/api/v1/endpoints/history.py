import csv
from io import StringIO
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_client_ip, get_current_user, require_admin
from app.db.session import get_db
from app.models.activity_log import ActivityAction, ActivityLog
from app.models.department import Department
from app.models.document import Document
from app.models.download_history import DownloadHistory
from app.models.user import User
from app.schemas.document import ActivityLogResponse, DownloadHistoryResponse, MessageResponse, PaginatedActivityLogs, PaginatedDownloadHistory
from app.services.activity_service import log_activity

router = APIRouter(tags=["Audit"])


def _history_response(item: DownloadHistory) -> DownloadHistoryResponse:
    return DownloadHistoryResponse(
        id=item.id,
        user_id=item.user_id,
        user_name=item.user.full_name if item.user else None,
        document_id=item.document_id,
        document_name=item.document.title if item.document else "Deleted document",
        department_id=item.department_id,
        department_name=item.department.name if item.department else None,
        ip_address=item.ip_address,
        downloaded_at=item.downloaded_at,
    )


def _activity_response(item: ActivityLog) -> ActivityLogResponse:
    return ActivityLogResponse(
        id=item.id,
        user_id=item.user_id,
        user_name=item.user.full_name if item.user else None,
        action=item.action.value,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        details=item.details,
        ip_address=item.ip_address,
        created_at=item.created_at,
    )


@router.get("/history", response_model=PaginatedDownloadHistory)
def list_download_history(
    search: str | None = None,
    department_id: UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedDownloadHistory:
    query = db.query(DownloadHistory).options(joinedload(DownloadHistory.user), joinedload(DownloadHistory.document), joinedload(DownloadHistory.department))
    if department_id:
        query = query.filter(DownloadHistory.department_id == department_id)
    if search:
        needle = f"%{search}%"
        query = query.join(Document).outerjoin(User).outerjoin(Department).filter(or_(Document.title.ilike(needle), User.full_name.ilike(needle), Department.name.ilike(needle)))
    total = query.count()
    items = query.order_by(DownloadHistory.downloaded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedDownloadHistory(items=[_history_response(item) for item in items], total=total, page=page, page_size=page_size)


@router.get("/history/export")
def export_download_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    items = db.query(DownloadHistory).options(joinedload(DownloadHistory.user), joinedload(DownloadHistory.document), joinedload(DownloadHistory.department)).order_by(DownloadHistory.downloaded_at.desc()).all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Downloaded At", "User", "Department", "Document", "IP Address"])
    for item in items:
        row = _history_response(item)
        writer.writerow([row.downloaded_at.isoformat(), row.user_name or "", row.department_name or "", row.document_name, row.ip_address or ""])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=download-history.csv"})


@router.delete("/history", response_model=MessageResponse)
def clear_download_history(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MessageResponse:
    count = db.query(DownloadHistory).delete()
    db.commit()
    log_activity(db, action=ActivityAction.HISTORY_CLEAR, user_id=current_user.id, entity_type="download_history", details=f"Cleared {count} download history records", ip_address=get_client_ip(request))
    return MessageResponse(message="Download history cleared")


@router.get("/activity", response_model=PaginatedActivityLogs)
def list_activity(
    search: str | None = None,
    action: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedActivityLogs:
    query = db.query(ActivityLog).options(joinedload(ActivityLog.user))
    if action:
        query = query.filter(ActivityLog.action == action)
    if search:
        needle = f"%{search}%"
        query = query.outerjoin(User).filter(or_(ActivityLog.details.ilike(needle), ActivityLog.entity_type.ilike(needle), User.full_name.ilike(needle)))
    total = query.count()
    items = query.order_by(ActivityLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedActivityLogs(items=[_activity_response(item) for item in items], total=total, page=page, page_size=page_size)
