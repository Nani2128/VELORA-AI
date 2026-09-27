import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.app.api.router import api_router
from backend.app.core.config import settings
from backend.app.core.errors import APIError, create_error_response
from backend.app.core.logging import setup_logging
from backend.app.core.request_id import RequestIdMiddleware

setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Middleware
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# Static file serving for local storage uploads
os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.LOCAL_STORAGE_DIR), name="uploads")


# Exception Handlers
@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    req_id = getattr(request.state, "request_id", "unknown")
    return create_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        request_id=req_id,
        details=exc.details,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    return create_error_response(
        code="INTERNAL_ERROR",
        message="An unexpected server error occurred.",
        status_code=500,
        request_id=req_id,
        details={"error": str(exc)} if settings.DEBUG else {},
    )


# Mount API V1 routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
# Also mount /health at root
from backend.app.api.health import health_check
app.add_api_route("/health", health_check, methods=["GET"], tags=["Health"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
