import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.asset import Asset
from backend.app.schemas.asset import AssetResponse
from backend.app.services.asset_service import asset_service
from backend.app.services.storage_service import storage_service

router = APIRouter(prefix="/library", tags=["Library"])
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("", response_model=List[AssetResponse])
def get_library_assets(
    type: Optional[str] = Query(None),
    project_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    assets = asset_service.get_user_assets(
        db=db,
        user_id=DEFAULT_USER_ID,
        asset_type=type,
        project_id=project_id,
        limit=limit,
        offset=offset,
    )

    return [
        AssetResponse(
            id=a.id,
            user_id=a.user_id,
            project_id=a.project_id,
            type=a.type,
            source=a.source,
            storage_key=a.storage_key,
            thumbnail_key=a.thumbnail_key,
            mime_type=a.mime_type,
            size_bytes=a.size_bytes,
            width=a.width,
            height=a.height,
            duration_seconds=a.duration_seconds,
            url=storage_service.get_public_url(a.storage_key),
            thumbnail_url=storage_service.get_public_url(a.thumbnail_key) if a.thumbnail_key else None,
            metadata=a.metadata_json or {},
            created_at=a.created_at,
        )
        for a in assets
    ]
