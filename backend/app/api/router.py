from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.api.assets import router as assets_router
from backend.app.api.generations import router as generations_router
from backend.app.api.projects import router as projects_router
from backend.app.api.library import router as library_router
from backend.app.api.history import router as history_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(assets_router)
api_router.include_router(generations_router)
api_router.include_router(projects_router)
api_router.include_router(library_router)
api_router.include_router(history_router)
