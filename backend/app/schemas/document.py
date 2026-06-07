from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    message: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    file_name: str
    file_type: str
    file_size: int
    department_id: UUID
    department_name: str
    uploaded_by_id: UUID | None = None
    uploaded_by_name: str | None = None
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime


class PaginatedDocuments(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class DownloadHistoryResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_name: str | None = None
    document_id: UUID
    document_name: str
    department_id: UUID | None = None
    department_name: str | None = None
    ip_address: str | None = None
    downloaded_at: datetime


class PaginatedDownloadHistory(BaseModel):
    items: list[DownloadHistoryResponse]
    total: int
    page: int
    page_size: int


class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_name: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime


class PaginatedActivityLogs(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    page: int
    page_size: int


class DashboardStats(BaseModel):
    total_documents: int
    total_downloads: int
    total_departments: int
    total_users: int
    documents_by_department: list[dict[str, int | str]]
    monthly_uploads: list[dict[str, int | str]]
    monthly_downloads: list[dict[str, int | str]]
    recent_activity: list[ActivityLogResponse]
    recent_uploads: list[DocumentResponse]
    recent_downloads: list[DownloadHistoryResponse]
