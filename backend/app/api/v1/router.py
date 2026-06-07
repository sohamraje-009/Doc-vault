from fastapi import APIRouter

from app.api.v1.endpoints import auth, dashboard, departments, documents, history, settings, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(documents.router)
api_router.include_router(departments.router)
api_router.include_router(users.router)
api_router.include_router(history.router)
api_router.include_router(settings.router)
