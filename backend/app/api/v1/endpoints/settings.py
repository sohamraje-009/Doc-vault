from pathlib import Path

import fastapi
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.activity_log import ActivityAction, ActivityLog
from app.models.document import Document
from app.models.download_history import DownloadHistory
from app.models.user import User
from app.schemas.document import ActivityLogResponse

router = APIRouter(prefix="/settings", tags=["Settings"])
settings = get_settings()


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


def _storage_usage_bytes() -> int:
    root = Path(settings.UPLOAD_DIR)
    if not root.exists():
        return 0
    return sum(path.stat().st_size for path in root.rglob("*") if path.is_file())


def _database_type() -> str:
    return settings.DATABASE_URL.split(":", 1)[0].replace("+psycopg", "").upper()


def _docker_status() -> str:
    if Path("/.dockerenv").exists():
        return "Detected"
    return "Not detected"


@router.get("/overview")
def settings_overview(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    last_login = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id, ActivityLog.action == ActivityAction.LOGIN)
        .order_by(ActivityLog.created_at.desc())
        .first()
    )
    activities = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(5)
        .all()
    )
    user_agent = request.headers.get("user-agent", "Current browser")

    return {
        "security": {
            "account_status": current_user.status.value,
            "role": current_user.role.value,
            "last_login_time": last_login.created_at if last_login else None,
            "authentication_method": "JWT",
            "active_session_count": 1,
        },
        "sessions": [
            {
                "id": "current",
                "device": "Current device",
                "browser": user_agent[:120],
                "last_active": last_login.created_at if last_login else None,
            }
        ],
        "system": {
            "application_version": "1.0.0",
            "fastapi_version": fastapi.__version__,
            "database_type": _database_type(),
            "environment": settings.ENVIRONMENT,
            "docker_status": _docker_status(),
        },
        "storage": {
            "total_documents": db.query(func.count(Document.id)).scalar() or 0,
            "total_downloads": db.query(func.count(DownloadHistory.id)).scalar() or 0,
            "total_users": db.query(func.count(User.id)).scalar() or 0,
            "storage_usage": _storage_usage_bytes(),
        },
        "activity": [_activity_response(item) for item in activities],
    }
