import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.models.generation import Generation
from backend.app.models.generation_job import GenerationJob
from backend.app.schemas.generation import GenerationCreateRequest
from backend.app.services.prompt_service import prompt_service
from backend.app.workers.generation_worker import process_generation_task


class GenerationService:
    @staticmethod
    async def create_generation(
        db: Session,
        user_id: uuid.UUID,
        req: GenerationCreateRequest,
    ) -> Generation:
        # Prepare prompt (if enhanced)
        raw_prompt, enhanced_prompt = await prompt_service.prepare_prompt(
            raw_prompt=req.prompt,
            generation_type=req.type,
            settings_dict=req.settings.model_dump(),
            enhance=req.enhance_prompt,
        )

        # Provider selection
        is_video = "VIDEO" in req.type.upper()
        provider = "google_veo_video" if is_video else "google_gemini_image"
        model = "veo-3.1-lite-generate-preview" if is_video else "gemini-3.1-flash-image"

        generation = Generation(
            id=uuid.uuid4(),
            user_id=user_id,
            project_id=req.project_id,
            type=req.type,
            prompt=raw_prompt,
            enhanced_prompt=enhanced_prompt,
            negative_prompt=req.negative_prompt,
            input_asset_id=req.input_asset_id,
            provider=provider,
            model=model,
            status="QUEUED",
            settings=req.settings.model_dump(),
            created_at=datetime.now(timezone.utc),
        )
        db.add(generation)

        # Create GenerationJob record
        job = GenerationJob(
            id=uuid.uuid4(),
            generation_id=generation.id,
            status="QUEUED",
            queued_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(generation)

        # Enqueue Celery worker background task
        process_generation_task.delay(str(generation.id))

        return generation

    @staticmethod
    def get_generation(db: Session, generation_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Generation]:
        return db.query(Generation).filter(Generation.id == generation_id, Generation.user_id == user_id).first()


generation_service = GenerationService()
