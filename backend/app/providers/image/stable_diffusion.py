import os
import aiohttp
from typing import Any, Dict, Optional
from backend.app.providers.image.base import ImageProvider
from backend.app.providers.base import ProviderResult


class StableDiffusionImageProvider(ImageProvider):
    def __init__(self):
        self.api_url = os.getenv("SD_API_URL")
        self.api_key = os.getenv("SD_API_KEY")
        self.model = os.getenv("SD_MODEL", "sdxl")
        self.enabled = os.getenv("SD_ENABLED", "false").lower() == "true" or bool(self.api_url)

    @property
    def provider_name(self) -> str:
        return "stable_diffusion"

    def is_available(self) -> bool:
        return self.enabled and bool(self.api_url)

    def supports(self, feature: str) -> bool:
        return feature in [
            "text_to_image", "image_to_image", "aspect_ratio", "seed", "steps", "guidance", "negative_prompt"
        ]

    def capabilities(self) -> list[str]:
        return ["text_to_image", "image_to_image", "aspect_ratio", "seed", "steps", "guidance", "negative_prompt"]

    async def generate_image(
        self,
        prompt: str,
        settings: Dict[str, Any],
        negative_prompt: Optional[str] = None,
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(
                success=False,
                error_code="PROVIDER_UNCONFIGURED",
                error_message="Stable Diffusion provider is unconfigured. Set SD_API_URL to activate.",
            )

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt or "blurry, low quality",
            "steps": settings.get("steps", 30),
            "cfg_scale": settings.get("guidance", 7.0),
            "seed": settings.get("seed"),
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.api_url, json=payload, headers=headers) as resp:
                    if resp.status != 200:
                        err = await resp.text()
                        return ProviderResult(
                            success=False,
                            error_code="SD_API_ERROR",
                            error_message=f"HTTP {resp.status}: {err[:200]}",
                        )
                    data = await resp.read()
                    return ProviderResult(
                        success=True,
                        media_bytes=data,
                        mime_type="image/png",
                    )
        except Exception as e:
            return ProviderResult(
                success=False,
                error_code="SD_CONNECTION_ERROR",
                error_message=str(e),
            )

    async def edit_image(
        self,
        prompt: str,
        input_image_bytes: bytes,
        input_mime_type: str,
        settings: Dict[str, Any],
    ) -> ProviderResult:
        return await self.generate_image(prompt, settings)
