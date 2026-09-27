from typing import Dict, Optional
from backend.app.providers.image.base import ImageProvider
from backend.app.providers.image.gemini_image import GeminiImageProvider
from backend.app.providers.video.base import VideoProvider
from backend.app.providers.video.gemini_video import GeminiVeoVideoProvider


class ProviderRegistry:
    def __init__(self):
        self._image_providers: Dict[str, ImageProvider] = {}
        self._video_providers: Dict[str, VideoProvider] = {}
        
        # Register defaults
        default_img = GeminiImageProvider("gemini-3.1-flash-image")
        self._image_providers["gemini-3.1-flash-image"] = default_img
        self._image_providers["gemini-3.1-flash-lite-image"] = GeminiImageProvider("gemini-3.1-flash-lite-image")
        
        default_vid = GeminiVeoVideoProvider("veo-3.1-lite-generate-preview")
        self._video_providers["veo-3.1-lite-generate-preview"] = default_vid
        self._video_providers["veo-3.1-generate-preview"] = GeminiVeoVideoProvider("veo-3.1-generate-preview")

    def get_image_provider(self, model: Optional[str] = None) -> Optional[ImageProvider]:
        if model and model in self._image_providers:
            return self._image_providers[model]
        return self._image_providers.get("gemini-3.1-flash-image")

    def get_video_provider(self, model: Optional[str] = None) -> Optional[VideoProvider]:
        if model and model in self._video_providers:
            return self._video_providers[model]
        return self._video_providers.get("veo-3.1-lite-generate-preview")


provider_registry = ProviderRegistry()
