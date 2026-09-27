import asyncio
import logging
import uuid
from datetime import datetime, timezone
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.generation import Generation
from backend.app.models.generation_job import GenerationJob
from backend.app.models.usage import UsageRecord
from backend.app.providers.registry import provider_registry
from backend.app.services.storage_service import storage_service
from backend.app.workers.celery_app import celery_app

logger = logging.getLogger("velora.worker.generation")


@celery_app.task(name="process_generation", bind=True, max_retries=3)
def process_generation_task(self, generation_id_str: str):
    db = SessionLocal()
    try:
        gen_id = uuid.UUID(generation_id_str)
        generation = db.query(Generation).filter(Generation.id == gen_id).first()
        job = db.query(GenerationJob).filter(GenerationJob.generation_id == gen_id).first()

        if not generation or not job:
            logger.error(f"Generation {generation_id_str} not found in worker")
            return

        # Transition status to PROCESSING
        generation.status = "PROCESSING"
        generation.started_at = datetime.now(timezone.utc)
        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        # Run provider asynchronously
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        effective_prompt = generation.enhanced_prompt or generation.prompt
        is_video = "VIDEO" in generation.type.upper()

        if is_video:
            # Video provider workflow
            provider = provider_registry.get_video_provider(generation.model)
            input_bytes = None
            input_mime = None
            if generation.input_asset_id:
                input_asset = db.query(Asset).filter(Asset.id == generation.input_asset_id).first()
                if input_asset:
                    input_bytes = loop.run_until_complete(storage_service.get(input_asset.storage_key))
                    input_mime = input_asset.mime_type

            # Step 1: Create operation
            result = loop.run_until_complete(
                provider.create_video_operation(
                    prompt=effective_prompt,
                    settings=generation.settings,
                    input_image_bytes=input_bytes,
                    input_mime_type=input_mime,
                )
            )

            if result.status == "FAILED" or not result.provider_operation_id:
                generation.status = "FAILED"
                generation.error_code = result.error.get("code") if result.error else "GENERATION_FAILED"
                generation.error_message = result.error.get("message") if result.error else "Failed to start video generation"
                job.status = "FAILED"
                db.commit()
                return

            generation.provider_operation_id = result.provider_operation_id
            db.commit()

            # Poll until completion or failure
            max_polls = 60
            poll_interval = 5
            downloaded_result = None

            for _ in range(max_polls):
                import time
                time.sleep(poll_interval)
                status_res = loop.run_until_complete(provider.get_operation_status(result.provider_operation_id))
                if status_res.status == "COMPLETED":
                    downloaded_result = loop.run_until_complete(provider.download_video(result.provider_operation_id))
                    break
                elif status_res.status == "FAILED":
                    generation.status = "FAILED"
                    generation.error_code = status_res.error.get("code") if status_res.error else "GENERATION_FAILED"
                    generation.error_message = status_res.error.get("message") if status_res.error else "Video generation failed"
                    job.status = "FAILED"
                    db.commit()
                    return

            if not downloaded_result or downloaded_result.status != "COMPLETED":
                generation.status = "FAILED"
                generation.error_code = "PROVIDER_TIMEOUT"
                generation.error_message = "Video operation timed out"
                job.status = "FAILED"
                db.commit()
                return

            # Store generated video
            ext = "mp4"
            key = f"videos/{generation.id}.{ext}"
            loop.run_until_complete(storage_service.put(key, downloaded_result.asset_data, downloaded_result.asset_mime_type))

            output_asset = Asset(
                id=uuid.uuid4(),
                user_id=generation.user_id,
                project_id=generation.project_id,
                type="VIDEO",
                source="GENERATED",
                storage_key=key,
                mime_type=downloaded_result.asset_mime_type,
                size_bytes=len(downloaded_result.asset_data),
                duration_seconds=5.0,
                metadata_json={"prompt": generation.prompt, "model": generation.model},
            )
            db.add(output_asset)
            generation.output_asset_id = output_asset.id
            generation.status = "COMPLETED"
            generation.completed_at = datetime.now(timezone.utc)
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

        else:
            # Image provider workflow
            provider = provider_registry.get_image_provider(generation.model)
            if generation.type == "IMAGE_TO_IMAGE" and generation.input_asset_id:
                input_asset = db.query(Asset).filter(Asset.id == generation.input_asset_id).first()
                input_bytes = loop.run_until_complete(storage_service.get(input_asset.storage_key)) if input_asset else b""
                result = loop.run_until_complete(
                    provider.edit_image(
                        prompt=effective_prompt,
                        input_image_bytes=input_bytes,
                        input_mime_type=input_asset.mime_type if input_asset else "image/png",
                        settings=generation.settings,
                    )
                )
            else:
                result = loop.run_until_complete(
                    provider.generate_image(
                        prompt=effective_prompt,
                        generation_settings=generation.settings,
                        negative_prompt=generation.negative_prompt,
                    )
                )

            if result.status == "FAILED" or not result.asset_data:
                generation.status = "FAILED"
                generation.error_code = result.error.get("code") if result.error else "GENERATION_FAILED"
                generation.error_message = result.error.get("message") if result.error else "Failed to generate image"
                job.status = "FAILED"
                db.commit()
                return

            ext = "png" if "png" in (result.asset_mime_type or "") else "jpg"
            key = f"images/{generation.id}.{ext}"
            loop.run_until_complete(storage_service.put(key, result.asset_data, result.asset_mime_type or "image/png"))

            output_asset = Asset(
                id=uuid.uuid4(),
                user_id=generation.user_id,
                project_id=generation.project_id,
                type="IMAGE",
                source="GENERATED",
                storage_key=key,
                mime_type=result.asset_mime_type or "image/png",
                size_bytes=len(result.asset_data),
                metadata_json={"prompt": generation.prompt, "model": generation.model},
            )
            db.add(output_asset)
            generation.output_asset_id = output_asset.id
            generation.status = "COMPLETED"
            generation.completed_at = datetime.now(timezone.utc)
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)

            # Record usage
            usage = UsageRecord(
                id=uuid.uuid4(),
                user_id=generation.user_id,
                generation_id=generation.id,
                provider=generation.provider,
                model=generation.model,
                input_units=1,
                output_units=1,
            )
            db.add(usage)
            db.commit()

    except Exception as exc:
        logger.error(f"Worker unhandled error: {exc}", exc_info=True)
        if "generation" in locals() and generation:
            generation.status = "FAILED"
            generation.error_code = "INTERNAL_ERROR"
            generation.error_message = str(exc)
            db.commit()
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()
