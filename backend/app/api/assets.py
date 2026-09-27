import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session
from backend.app.core.errors import APIError
from backend.app.db.session import get_db
from backend.app.schemas.asset import AssetResponse
from backend.app.services.asset_service import asset_service
from backend.app.services.storage_service import storage_service

router = APIRouter(prefix="/assets", tags=["Assets"])

# Mock default user UUID for single-user dev auth
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload", response_model=AssetResponse)
async def upload_asset(
    file: UploadFile = File(...),
    project_id: Optional[uuid.UUID] = Form(None),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported media format. Only JPEG, PNG, and WebP are allowed."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds 20MB limit.")

    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "png"
    storage_key = f"uploads/{uuid.uuid4()}.{ext}"
    await storage_service.put(storage_key, file_bytes, file.content_type)

    asset = asset_service.create_asset_record(
        db=db,
        user_id=DEFAULT_USER_ID,
        asset_type="IMAGE",
        source="UPLOAD",
        storage_key=storage_key,
        mime_type=file.content_type,
        size_bytes=len(file_bytes),
        project_id=project_id,
        metadata={"original_filename": file.filename},
    )

    return AssetResponse(
        id=asset.id,
        user_id=asset.user_id,
        project_id=asset.project_id,
        type=asset.type,
        source=asset.source,
        storage_key=asset.storage_key,
        thumbnail_key=asset.thumbnail_key,
        mime_type=asset.mime_type,
        size_bytes=asset.size_bytes,
        url=storage_service.get_public_url(asset.storage_key),
        metadata=asset.metadata_json or {},
        created_at=asset.created_at,
    )
