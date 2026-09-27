from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class AssetResponse(BaseModel):
    id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    type: str  # "IMAGE" | "VIDEO" | "AUDIO"
    source: str  # "UPLOAD" | "GENERATED" | "EDITED"
    storage_key: str
    thumbnail_key: Optional[str] = None
    mime_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    url: str
    thumbnail_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True
