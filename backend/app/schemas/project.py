from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    cover_asset_id: Optional[UUID] = None


class ProjectResponse(ProjectBase):
    id: UUID
    user_id: UUID
    cover_asset_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    asset_count: int = 0

    class Config:
        from_attributes = True
