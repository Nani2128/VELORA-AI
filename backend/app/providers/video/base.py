from abc import abstractmethod
from typing import Any, Dict, Optional
from backend.app.providers.base import BaseAIProvider, ProviderResult


class VideoProvider(BaseAIProvider):
    @abstractmethod
    async def create_video_operation(
        self,
        prompt: str,
        settings: Dict[str, Any],
        input_image_bytes: Optional[bytes] = None,
        input_mime_type: Optional[str] = None,
    ) -> ProviderResult:
        pass

    @abstractmethod
    async def get_operation_status(self, operation_name: str) -> ProviderResult:
        pass

    @abstractmethod
    async def download_video(self, operation_name: str) -> ProviderResult:
        pass
