import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.asset import Asset
from backend.app.models.generation import Generation
from backend.app.schemas.generation import GenerationResponse
from backend.app.services.storage_service import storage_service

router = APIRouter(prefix="/history", tags=["History"])
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("", response_model=List[GenerationResponse])
def get_generation_history(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(Generation).filter(Generation.user_id == DEFAULT_USER_ID)
    if status:
        query = query.filter(Generation.status == status.upper())
    if type:
        query = query.filter(Generation.type == type.upper())

    generations = query.order_by(Generation.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for g in generations:
        out_dict = None
        if g.output_asset_id:
            asset = db.query(Asset).filter(Asset.id == g.output_asset_id).first()
            if asset:
                out_dict = {
                    "id": str(asset.id),
                    "type": asset.type,
                    "url": storage_service.get_public_url(asset.storage_key),
                    "mime_type": asset.mime_type,
                }
        resp = GenerationResponse.model_validate(g)
        resp.output_asset = out_dict
        results.append(resp)

    return results
