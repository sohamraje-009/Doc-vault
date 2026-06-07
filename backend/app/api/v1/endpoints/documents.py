import csv
import html
import json
import mimetypes
from pathlib import Path
from xml.etree import ElementTree
import zipfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.deps import get_client_ip, get_current_user, require_admin
from app.db.session import get_db
from app.models.activity_log import ActivityAction
from app.models.department import Department
from app.models.document import Document
from app.models.document_tag import DocumentTag
from app.models.download_history import DownloadHistory
from app.models.user import User, UserRole
from app.schemas.document import DocumentResponse, MessageResponse, PaginatedDocuments
from app.services.activity_service import log_activity
from app.storage.local import get_storage

router = APIRouter(prefix="/documents", tags=["Documents"])
settings = get_settings()


def _serialize_document(document: Document) -> DocumentResponse:
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


def _document_query(db: Session):
    return db.query(Document).options(
        joinedload(Document.department),
        joinedload(Document.uploaded_by),
        joinedload(Document.tags),
    )


def _restrict_documents_for_user(query, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return query
    if not current_user.department_id:
        return query.filter(False)
    return query.filter(Document.department_id == current_user.department_id)


def _get_allowed_document(db: Session, document_id: UUID, current_user: User) -> Document:
    document = _restrict_documents_for_user(
        _document_query(db).filter(Document.id == document_id),
        current_user,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def _page_html(title: str, body: str) -> str:
    safe_title = html.escape(title)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>{safe_title}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }}
    header {{ position: sticky; top: 0; background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 14px 22px; }}
    main {{ padding: 22px; max-width: 1120px; margin: 0 auto; }}
    section {{ background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin-bottom: 16px; }}
    h1 {{ font-size: 18px; margin: 0; }}
    h2 {{ font-size: 15px; margin: 0 0 12px; }}
    p {{ line-height: 1.55; white-space: pre-wrap; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
    td, th {{ border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }}
    pre {{ white-space: pre-wrap; word-break: break-word; margin: 0; }}
  </style>
</head>
<body>
  <header><h1>{safe_title}</h1></header>
  <main>{body}</main>
</body>
</html>"""


def _xml_texts(root: ElementTree.Element) -> list[str]:
    return [node.text for node in root.iter() if node.text and node.text.strip()]


def _docx_preview(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    paragraphs = "\n".join(html.escape(text) for text in _xml_texts(root))
    return f"<section><p>{paragraphs or 'No previewable text found.'}</p></section>"


def _pptx_preview(path: Path) -> str:
    sections: list[str] = []
    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(name for name in archive.namelist() if name.startswith("ppt/slides/slide") and name.endswith(".xml"))
        for index, name in enumerate(slide_names, start=1):
            root = ElementTree.fromstring(archive.read(name))
            text = "\n".join(html.escape(value) for value in _xml_texts(root))
            sections.append(f"<section><h2>Slide {index}</h2><p>{text or 'No text on this slide.'}</p></section>")
    return "".join(sections) or "<section><p>No previewable slides found.</p></section>"


def _xlsx_preview(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [" ".join(_xml_texts(item)) for item in root]

        sheet_names = sorted(name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"))
        sections: list[str] = []
        for sheet_index, sheet_name in enumerate(sheet_names[:5], start=1):
            root = ElementTree.fromstring(archive.read(sheet_name))
            rows: list[str] = []
            for row in root.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                cells: list[str] = []
                for cell in row.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                    value_node = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                    value = value_node.text if value_node is not None and value_node.text else ""
                    if cell.attrib.get("t") == "s" and value.isdigit() and int(value) < len(shared):
                        value = shared[int(value)]
                    cells.append(f"<td>{html.escape(value)}</td>")
                rows.append(f"<tr>{''.join(cells)}</tr>")
                if len(rows) >= 100:
                    break
            sections.append(f"<section><h2>Sheet {sheet_index}</h2><table>{''.join(rows)}</table></section>")
    return "".join(sections) or "<section><p>No previewable sheet data found.</p></section>"


def _text_preview(path: Path) -> str:
    raw = path.read_bytes()
    text = raw[:300_000].decode("utf-8", errors="replace")
    if path.suffix.lower() == ".json":
        try:
            text = json.dumps(json.loads(text), indent=2)
        except json.JSONDecodeError:
            pass
    return f"<section><pre>{html.escape(text)}</pre></section>"


def _rtf_preview(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    cleaned = []
    skip_control = False
    for char in text:
        if char == "\\":
            skip_control = True
            continue
        if skip_control and (char.isalpha() or char.isdigit() or char in "-*"):
            continue
        skip_control = False
        if char not in "{}":
            cleaned.append(char)
    return f"<section><pre>{html.escape(''.join(cleaned).strip() or 'No previewable text found.')}</pre></section>"


def _generic_preview(path: Path) -> str:
    raw = path.read_bytes()[:300_000]
    if not raw:
        return "<section><p>This file is empty.</p></section>"
    binary_extensions = {
        ".heic",
        ".heif",
        ".raw",
        ".cr2",
        ".nef",
        ".arw",
        ".dng",
        ".psd",
        ".ai",
        ".eps",
        ".zip",
        ".rar",
        ".7z",
        ".exe",
        ".dll",
        ".bin",
        ".dat",
        ".db",
        ".sqlite",
    }
    if path.suffix.lower() in binary_extensions or b"\x00" in raw:
        return (
            "<section><p>Preview is not available for this binary file type in the browser. "
            "Please download the file, or convert it to PNG/JPG/PDF and upload that version for browser preview.</p></section>"
        )
    text = raw.decode("utf-8", errors="replace")
    replacement_count = text.count("\ufffd")
    if replacement_count / max(len(text), 1) > 0.02:
        return (
            "<section><p>Preview is not available for this binary file type in the browser. "
            "Please download the file, or convert it to PNG/JPG/PDF and upload that version for browser preview.</p></section>"
        )
    printable = sum(1 for char in text if char.isprintable() or char.isspace())
    if printable / max(len(text), 1) > 0.85:
        return f"<section><pre>{html.escape(text)}</pre></section>"
    return "<section><p>Preview is not available for this binary file type. Please download the file to view it in its native application.</p></section>"


def _csv_preview(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = []
    for index, row in enumerate(csv.reader(text.splitlines())):
        rows.append(f"<tr>{''.join(f'<td>{html.escape(cell)}</td>' for cell in row)}</tr>")
        if index >= 100:
            break
    return f"<section><table>{''.join(rows)}</table></section>"


def _heic_cache_path(document_id: UUID, source: Path) -> Path:
    stat = source.stat()
    cache_dir = Path(settings.UPLOAD_DIR) / ".preview_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{document_id}-{stat.st_mtime_ns}-{stat.st_size}.jpg"


def _build_heic_png_cache(source: Path, cache_path: Path) -> None:
    try:
        import io

        from PIL import Image
        import pillow_heif
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="HEIC preview support is not installed") from exc

    pillow_heif.register_heif_opener()
    with Image.open(source) as image:
        image.thumbnail((1600, 1600))
        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=78, optimize=True)
    cache_path.write_bytes(output.getvalue())


def _heic_png_response(document_id: UUID, path: Path) -> FileResponse:
    cache_path = _heic_cache_path(document_id, path)
    if not cache_path.exists():
        for stale in cache_path.parent.glob(f"{document_id}-*.png"):
            stale.unlink(missing_ok=True)
        for stale in cache_path.parent.glob(f"{document_id}-*.jpg"):
            stale.unlink(missing_ok=True)
        _build_heic_png_cache(path, cache_path)
    return FileResponse(cache_path, filename=f"{path.stem}.jpg", media_type="image/jpeg")


@router.get("", response_model=PaginatedDocuments)
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    department_id: UUID | None = None,
    file_type: str | None = None,
    sort_by: str = Query("created_at", pattern="^(title|file_type|file_size|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> PaginatedDocuments:
    query = _restrict_documents_for_user(_document_query(db), current_user)
    if department_id:
        query = query.filter(Document.department_id == department_id)
    if file_type:
        query = query.filter(Document.file_type.ilike(f"%{file_type}%"))
    if search:
        needle = f"%{search.strip()}%"
        query = query.outerjoin(DocumentTag).join(Department).outerjoin(User, Document.uploaded_by_id == User.id)
        query = query.filter(
            or_(
                Document.title.ilike(needle),
                Document.file_name.ilike(needle),
                Document.file_type.ilike(needle),
                DocumentTag.tag.ilike(needle),
                Department.name.ilike(needle),
                User.full_name.ilike(needle),
            )
        ).distinct()

    total = query.count()
    sort_column = getattr(Document, sort_by)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedDocuments(
        items=[_serialize_document(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    department_id: UUID = Form(...),
    description: str | None = Form(None),
    tags: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if current_user.role != UserRole.ADMIN and current_user.department_id != department_id:
        raise HTTPException(status_code=403, detail="You can upload documents only to your own department")

    original_name = file.filename or "document"
    extension = Path(original_name).suffix.lower()
    if "*" not in settings.ALLOWED_EXTENSIONS and extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > settings.max_file_size_bytes:
            raise HTTPException(status_code=413, detail="File exceeds upload size limit")
    await file.seek(0)

    storage_path, _stored_name = await get_storage().save(file, str(department_id))
    document = Document(
        title=title.strip(),
        description=description,
        file_name=Path(original_name).name,
        file_path=storage_path,
        file_type=extension.lstrip(".").upper() or "FILE",
        file_size=size,
        department_id=department_id,
        uploaded_by_id=current_user.id,
    )
    db.add(document)
    db.flush()

    if extension in {".heic", ".heif"}:
        _build_heic_png_cache(get_storage().get_full_path(storage_path), _heic_cache_path(document.id, get_storage().get_full_path(storage_path)))

    tag_values = [tag.strip().lower() for tag in (tags or "").split(",") if tag.strip()]
    for tag in sorted(set(tag_values)):
        db.add(DocumentTag(document_id=document.id, tag=tag))
    db.commit()
    db.refresh(document)

    log_activity(
        db,
        action=ActivityAction.UPLOAD,
        user_id=current_user.id,
        entity_type="document",
        entity_id=str(document.id),
        details=f"Uploaded document {document.title}",
        ip_address=get_client_ip(request),
    )
    document = _document_query(db).filter(Document.id == document.id).first()
    return _serialize_document(document)  # type: ignore[arg-type]


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    document = _get_allowed_document(db, document_id, current_user)
    return _serialize_document(document)


@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_allowed_document(db, document_id, current_user)

    full_path = get_storage().get_full_path(document.file_path)
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File missing from storage")

    history = DownloadHistory(
        user_id=current_user.id,
        document_id=document.id,
        department_id=document.department_id,
        ip_address=get_client_ip(request),
    )
    db.add(history)
    db.commit()
    log_activity(
        db,
        action=ActivityAction.DOWNLOAD,
        user_id=current_user.id,
        entity_type="document",
        entity_id=str(document.id),
        details=f"Downloaded document {document.title}",
        ip_address=get_client_ip(request),
    )
    media_type = mimetypes.guess_type(document.file_name)[0] or "application/octet-stream"
    return FileResponse(full_path, filename=document.file_name, media_type=media_type)


@router.get("/{document_id}/preview")
def preview_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_allowed_document(db, document_id, current_user)
    full_path = get_storage().get_full_path(document.file_path)
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File missing from storage")
    if full_path.suffix.lower() in {".heic", ".heif"}:
        return _heic_png_response(document.id, full_path)
    media_type = mimetypes.guess_type(document.file_name)[0] or "application/octet-stream"
    return FileResponse(full_path, filename=document.file_name, media_type=media_type)


@router.get("/{document_id}/preview-html", response_class=HTMLResponse)
def preview_document_html(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HTMLResponse:
    document = _get_allowed_document(db, document_id, current_user)
    full_path = get_storage().get_full_path(document.file_path)
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File missing from storage")

    extension = full_path.suffix.lower()
    try:
        if extension == ".docx":
            body = _docx_preview(full_path)
        elif extension == ".xlsx":
            body = _xlsx_preview(full_path)
        elif extension == ".pptx":
            body = _pptx_preview(full_path)
        elif extension == ".csv":
            body = _csv_preview(full_path)
        elif extension == ".rtf":
            body = _rtf_preview(full_path)
        elif extension in {
            ".txt",
            ".log",
            ".json",
            ".xml",
            ".html",
            ".htm",
            ".md",
            ".csv",
            ".tsv",
            ".sql",
            ".py",
            ".js",
            ".ts",
            ".tsx",
            ".jsx",
            ".css",
            ".scss",
            ".ini",
            ".cfg",
            ".conf",
            ".yaml",
            ".yml",
            ".bat",
            ".ps1",
        }:
            body = _text_preview(full_path)
        else:
            body = _generic_preview(full_path)
    except (KeyError, UnicodeDecodeError, zipfile.BadZipFile, ElementTree.ParseError):
        body = "<section><p>Could not generate a preview for this file. Please download the file to view it.</p></section>"

    return HTMLResponse(_page_html(document.file_name, body))


@router.delete("/{document_id}", response_model=MessageResponse)
async def delete_document(
    document_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MessageResponse:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    title = document.title
    await get_storage().delete(document.file_path)
    db.delete(document)
    db.commit()
    log_activity(
        db,
        action=ActivityAction.DELETE,
        user_id=current_user.id,
        entity_type="document",
        entity_id=str(document_id),
        details=f"Deleted document {title}",
        ip_address=get_client_ip(request),
    )
    return MessageResponse(message="Document deleted")
