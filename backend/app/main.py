from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.init_db import ensure_password_reset_table, ensure_user_profile_columns, seed_departments
from app.db.session import SessionLocal
from app.services.auth_service import create_default_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        ensure_user_profile_columns(db)
        ensure_password_reset_table(db)
        seed_departments(db)
        create_default_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Devgiri Forgings — Secure Enterprise Document Management System. Centralized document storage, search, and auditability.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": settings.PROJECT_NAME}
