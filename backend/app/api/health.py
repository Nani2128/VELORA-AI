from fastapi import APIRouter
from backend.app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "database": "healthy",
        "redis": "healthy",
        "storage": settings.STORAGE_PROVIDER,
        "providers": {
            "google_gemini": bool(settings.GEMINI_API_KEY)
        }
    }
