import base64
import logging
from typing import Any, Dict, Optional
from google import genai
from backend.app.core.config import settings
from backend.app.providers.base import ProviderResult
from backend.app.providers.image.base import ImageProvider

logger = logging.getLogger("velora.provider.gemini_image")


class GeminiImageProvider(ImageProvider):
    def __init__(self, model_name: str = "gemini-3.1-flash-image"):
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
        return "google_gemini_image"

    def is_available(self) -> bool:
        return bool(self.client and self._api_key)

    async def generate_image(
        self,
        prompt: str,
        generation_settings: Dict[str, Any],
        negative_prompt: Optional[str] = None,
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(
                status="FAILED",
                error={
                    "code": "PROVIDER_AUTH_ERROR",
                    "message": "Gemini API key is not configured on the server."
                }
            )

        aspect_ratio = generation_settings.get("aspect_ratio", "16:9")
        if aspect_ratio not in ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"]:
            aspect_ratio = "16:9"

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents={"parts": [{"text": prompt}]},
                config={
                    "imageConfig": {
                        "aspectRatio": aspect_ratio,
                        "imageSize": "1K"
                    }
                }
            )

            # Search parts for inlineData image
            for candidate in response.candidates:
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        raw_data = base64.b64decode(part.inline_data.data)
                        return ProviderResult(
                            status="COMPLETED",
                            asset_data=raw_data,
                            asset_mime_type=part.inline_data.mime_type or "image/png",
                            metadata={
                                "model": self.model_name,
                                "aspect_ratio": aspect_ratio,
                                "prompt": prompt
                            }
                        )

            return ProviderResult(
                status="FAILED",
                error={
                    "code": "GENERATION_FAILED",
                    "message": "Model response contained no image data parts."
                }
            )
        except Exception as e:
            err_str = str(e)
            logger.error(f"Gemini image generation error: {err_str}")
            code = "GENERATION_FAILED"
            if "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower() or "429" in err_str:
                code = "PROVIDER_RATE_LIMITED"
            elif "SAFETY" in err_str.upper() or "blocked" in err_str.lower():
                code = "PROVIDER_SAFETY_REJECTED"
            elif "not found" in err_str.lower() or "unsupported" in err_str.lower():
                code = "PROVIDER_UNAVAILABLE"
            return ProviderResult(
                status="FAILED",
                error={"code": code, "message": err_str}
            )

    async def edit_image(
        self,
        prompt: str,
        input_image_bytes: bytes,
        input_mime_type: str,
        generation_settings: Dict[str, Any],
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(
                status="FAILED",
                error={
                    "code": "PROVIDER_AUTH_ERROR",
                    "message": "Gemini API key is not configured on the server."
                }
            )

        try:
            b64_img = base64.b64encode(input_image_bytes).decode("utf-8")
            response = self.client.models.generate_content(
                model=self.model_name,
                contents={
                    "parts": [
                        {"inline_data": {"data": b64_img, "mime_type": input_mime_type}},
                        {"text": prompt}
                    ]
                }
            )

            for candidate in response.candidates:
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        raw_data = base64.b64decode(part.inline_data.data)
                        return ProviderResult(
                            status="COMPLETED",
                            asset_data=raw_data,
                            asset_mime_type=part.inline_data.mime_type or "image/png",
                            metadata={"model": self.model_name, "prompt": prompt}
                        )

            return ProviderResult(
                status="FAILED",
                error={"code": "GENERATION_FAILED", "message": "No edited image generated."}
            )
        except Exception as e:
            err_str = str(e)
            code = "GENERATION_FAILED"
            if "quota" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str:
                code = "PROVIDER_RATE_LIMITED"
            return ProviderResult(status="FAILED", error={"code": code, "message": err_str})
