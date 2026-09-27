from abc import abstractmethod
from typing import Any, Dict, Optional
from backend.app.providers.base import BaseAIProvider, ProviderResult


class ImageProvider(BaseAIProvider):
    @abstractmethod
    async def generate_image(
        self,
        prompt: str,
        settings: Dict[str, Any],
        negative_prompt: Optional[str] = None,
    ) -> ProviderResult:
        pass

    @abstractmethod
    async def edit_image(
        self,
        prompt: str,
        input_image_bytes: bytes,
        input_mime_type: str,
        settings: Dict[str, Any],
    ) -> ProviderResult:
        pass
