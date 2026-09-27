import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.app.db.base import Base


class Generation(Base):
    __tablename__ = "generations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(String(32), nullable=False)  # TEXT_TO_IMAGE, IMAGE_TO_IMAGE, IMAGE_TO_VIDEO, TEXT_TO_VIDEO
    prompt = Column(Text, nullable=False)
    enhanced_prompt = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    input_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    output_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    provider = Column(String(64), nullable=False)
    model = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default="QUEUED", index=True)  # IDLE, PREPARING, QUEUED, PROCESSING, FINALIZING, COMPLETED, FAILED, CANCELLED
    settings = Column(JSON, nullable=False, default=dict)
    provider_operation_id = Column(String(255), nullable=True)
    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_generations_user_created", "user_id", "created_at"),
        Index("ix_generations_status_created", "status", "created_at"),
    )
