import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.asset import Asset
from backend.app.models.generation import Generation
from backend.app.schemas.generation import GenerationCreateRequest, GenerationResponse
from backend.app.services.generation_service import generation_service
from backend.app.services.storage_service import storage_service

router = APIRouter(prefix="/generations", tags=["Generations"])
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("", response_model=GenerationResponse)
async def create_generation(
    req: GenerationCreateRequest,
    idempotency_key: str = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
):
    generation = await generation_service.create_generation(
        db=db,
        user_id=DEFAULT_USER_ID,
        req=req,
    )
    return generation


@router.get("/{generation_id}", response_model=GenerationResponse)
def get_generation(
    generation_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    gen = generation_service.get_generation(db, generation_id, DEFAULT_USER_ID)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")

    output_asset_dict = None
    if gen.output_asset_id:
        out_asset = db.query(Asset).filter(Asset.id == gen.output_asset_id).first()
        if out_asset:
            output_asset_dict = {
                "id": str(out_asset.id),
                "type": out_asset.type,
                "url": storage_service.get_public_url(out_asset.storage_key),
                "mime_type": out_asset.mime_type,
            }

    resp = GenerationResponse.model_validate(gen)
    resp.output_asset = output_asset_dict
    return resp


@router.get("/{generation_id}/events")
async def generation_events_sse(
    generation_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Server-Sent Events endpoint streaming real-time generation status updates."""
    async def event_generator():
        last_status = None
        for _ in range(120):  # poll up to 2 minutes
            gen = db.query(Generation).filter(Generation.id == generation_id).first()
            if gen and gen.status != last_status:
                last_status = gen.status
                output_url = None
                if gen.output_asset_id:
                    out_asset = db.query(Asset).filter(Asset.id == gen.output_asset_id).first()
                    if out_asset:
                        output_url = storage_service.get_public_url(out_asset.storage_key)

                payload = {
                    "generation_id": str(gen.id),
                    "status": gen.status,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "output_asset_id": str(gen.output_asset_id) if gen.output_asset_id else None,
                    "output_url": output_url,
                    "error": {"code": gen.error_code, "message": gen.error_message} if gen.error_code else None,
                }
                yield f"event: generation.status\ndata: {json.dumps(payload)}\n\n"

                if gen.status in ["COMPLETED", "FAILED", "CANCELLED"]:
                    break
            await asyncio.sleep(1.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{generation_id}/cancel")
def cancel_generation(
    generation_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    gen = generation_service.get_generation(db, generation_id, DEFAULT_USER_ID)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    if gen.status in ["COMPLETED", "FAILED"]:
        return {"status": gen.status, "message": "Cannot cancel finished generation"}

    gen.status = "CANCELLED"
    db.commit()
    return {"status": "CANCELLED", "id": str(gen.id)}
