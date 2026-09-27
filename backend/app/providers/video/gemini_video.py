import base64
import logging
from typing import Any, Dict, Optional
import httpx
from google import genai
from backend.app.core.config import settings
from backend.app.providers.base import ProviderResult
from backend.app.providers.video.base import VideoProvider

logger = logging.getLogger("velora.provider.gemini_video")


class GeminiVeoVideoProvider(VideoProvider):
    def __init__(self, model_name: str = "veo-3.1-lite-generate-preview"):
        self.model_name = model_name
        self._api_key = settings.GEMINI_API_KEY
        self.client = None
        if self._api_key:
            self.client = genai.Client(
                api_key=self._api_key,
                http_options={"headers": {"User-Agent": "aistudio-build"}}
            )

    @property
    def name(self) -> str:
        return "google_veo_video"

    def is_available(self) -> bool:
        return bool(self.client and self._api_key)

    async def create_video_operation(
        self,
        prompt: str,
        generation_settings: Dict[str, Any],
        input_image_bytes: Optional[bytes] = None,
        input_mime_type: Optional[str] = None,
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(
                status="FAILED",
                error={
                    "code": "PROVIDER_AUTH_ERROR",
                    "message": "Gemini/Veo API credentials are not configured on server."
                }
            )

        aspect_ratio = generation_settings.get("aspect_ratio", "16:9")
        if aspect_ratio not in ["16:9", "9:16"]:
            aspect_ratio = "16:9"

        try:
            req_kwargs: Dict[str, Any] = {
                "model": self.model_name,
                "prompt": prompt,
                "config": {
                    "numberOfVideos": 1,
                    "resolution": "720p",
                    "aspectRatio": aspect_ratio
                }
            }

            if input_image_bytes and input_mime_type:
                b64_img = base64.b64encode(input_image_bytes).decode("utf-8")
                req_kwargs["image"] = {
                    "imageBytes": b64_img,
                    "mimeType": input_mime_type
                }

            operation = self.client.models.generate_videos(**req_kwargs)
            return ProviderResult(
                provider_operation_id=operation.name,
                status="PROCESSING",
                metadata={"model": self.model_name, "operation_name": operation.name}
            )
        except Exception as e:
            err_str = str(e)
            logger.error(f"Veo video generation error: {err_str}")
            code = "GENERATION_FAILED"
            if "quota" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str:
                code = "PROVIDER_RATE_LIMITED"
            elif "not found" in err_str.lower() or "permission" in err_str.lower():
                code = "PROVIDER_UNAVAILABLE"
            return ProviderResult(status="FAILED", error={"code": code, "message": err_str})

    async def get_operation_status(self, operation_name: str) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(status="FAILED", error={"code": "PROVIDER_AUTH_ERROR", "message": "Not configured"})

        try:
            op_obj = genai.types.GenerateVideosOperation(name=operation_name)
            updated = self.client.operations.get_videos_operation(operation=op_obj)
            
            if updated.done:
                return ProviderResult(
                    provider_operation_id=operation_name,
                    status="COMPLETED",
                    metadata={"done": True, "raw_response": str(updated.response)}
                )
            return ProviderResult(
                provider_operation_id=operation_name,
                status="PROCESSING",
                metadata={"done": False}
            )
        except Exception as e:
            return ProviderResult(status="FAILED", error={"code": "GENERATION_FAILED", "message": str(e)})

    async def download_video(self, operation_name: str) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(status="FAILED", error={"code": "PROVIDER_AUTH_ERROR", "message": "Not configured"})

        try:
            op_obj = genai.types.GenerateVideosOperation(name=operation_name)
            updated = self.client.operations.get_videos_operation(operation=op_obj)
            
            generated_videos = updated.response.generated_videos if updated.response else []
            if not generated_videos or not generated_videos[0].video:
                return ProviderResult(status="FAILED", error={"code": "GENERATION_FAILED", "message": "No video URL in completed operation"})

            video_uri = generated_videos[0].video.uri
            async with httpx.AsyncClient(timeout=120.0) as http_client:
                resp = await http_client.get(video_uri, headers={"x-goog-api-key": self._api_key})
                resp.raise_for_status()
                video_bytes = resp.content

            return ProviderResult(
                provider_operation_id=operation_name,
                status="COMPLETED",
                asset_data=video_bytes,
                asset_mime_type="video/mp4",
                metadata={"uri": video_uri}
            )
        except Exception as e:
            return ProviderResult(status="FAILED", error={"code": "STORAGE_ERROR", "message": str(e)})
