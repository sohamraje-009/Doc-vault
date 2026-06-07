import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, _utcnow


class ActivityAction(str, enum.Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    DELETE = "delete"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    DEPARTMENT_CREATE = "department_create"
    DEPARTMENT_UPDATE = "department_update"
    DEPARTMENT_DELETE = "department_delete"
    HISTORY_CLEAR = "history_clear"


class ActivityLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[ActivityAction] = mapped_column(
        Enum(ActivityAction, name="activity_action", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
        index=True,
    )

    user = relationship("User", back_populates="activity_logs")
