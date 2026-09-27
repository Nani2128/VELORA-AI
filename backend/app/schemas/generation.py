from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class GenerationSettingsSchema(BaseModel):
    aspect_ratio: str = Field(default="16:9")
    duration: int = Field(default=5, ge=1, le=120)
    quality: str = Field(default="standard")
    motion_strength: int = Field(default=5, ge=1, le=10)
    camera_movement: str = Field(default="static")
    style: str = Field(default="cinematic")
    fps: int = Field(default=24)
    seed: Optional[int] = None


class GenerationCreateRequest(BaseModel):
    type: str = Field(..., description="TEXT_TO_IMAGE, IMAGE_TO_IMAGE, IMAGE_TO_VIDEO, TEXT_TO_VIDEO")
    prompt: str = Field(..., min_length=1, max_length=5000)
    negative_prompt: Optional[str] = Field(None, max_length=2000)
    input_asset_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    enhance_prompt: bool = Field(default=False)
    settings: GenerationSettingsSchema = Field(default_factory=GenerationSettingsSchema)


class GenerationResponse(BaseModel):
    id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    type: str
    prompt: str
    enhanced_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    input_asset_id: Optional[UUID] = None
    output_asset_id: Optional[UUID] = None
    provider: str
    model: str
    status: str  # IDLE, PREPARING, QUEUED, PROCESSING, FINALIZING, COMPLETED, FAILED, CANCELLED
    settings: Dict[str, Any] = Field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    output_asset: Optional[Dict[str, Any]] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerationStatusEvent(BaseModel):
    generation_id: UUID
    status: str
    timestamp: str
    output_asset_id: Optional[UUID] = None
    output_url: Optional[str] = None
    error: Optional[Dict[str, Any]] = None
