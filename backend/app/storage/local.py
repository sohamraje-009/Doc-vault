from abc import ABC, abstractmethod
from pathlib import Path
from uuid import uuid4

import aiofiles
from fastapi import UploadFile

from app.core.config import get_settings

settings = get_settings()


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, file: UploadFile, department_id: str) -> tuple[str, str]:
        """Save file and return (storage_path, stored_filename)."""

    @abstractmethod
    async def read(self, file_path: str) -> bytes:
        """Read file contents."""

    @abstractmethod
    async def delete(self, file_path: str) -> None:
        """Delete file from storage."""

    @abstractmethod
    def get_full_path(self, file_path: str) -> Path:
        """Resolve full filesystem path for local storage."""


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = Path(base_dir or settings.UPLOAD_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _dept_dir(self, department_id: str) -> Path:
        path = self.base_dir / department_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def save(self, file: UploadFile, department_id: str) -> tuple[str, str]:
        ext = Path(file.filename or "file").suffix.lower()
        stored_name = f"{uuid4()}{ext}"
        relative = f"{department_id}/{stored_name}"
        self._dept_dir(department_id)
        full_path = self.base_dir / relative

        async with aiofiles.open(full_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                await out.write(chunk)

        return relative, stored_name

    async def read(self, file_path: str) -> bytes:
        full_path = self.base_dir / file_path
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

    async def delete(self, file_path: str) -> None:
        full_path = self.base_dir / file_path
        if full_path.exists():
            full_path.unlink()

    def get_full_path(self, file_path: str) -> Path:
        return self.base_dir / file_path


def get_storage() -> StorageBackend:
    return LocalStorageBackend()
