from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MessageResponse(BaseModel):
    message: str


class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class DepartmentResponse(DepartmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
