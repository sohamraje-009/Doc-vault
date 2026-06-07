from sqlalchemy.orm import Session

from app.models.activity_log import ActivityAction, ActivityLog


def log_activity(
    db: Session,
    *,
    action: ActivityAction,
    user_id=None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
