from typing import Dict, List, Optional
from backend.app.providers.image.base import ImageProvider
from backend.app.providers.image.gemini_image import GeminiImageProvider
from backend.app.providers.image.flux import FluxImageProvider
from backend.app.providers.image.stable_diffusion import StableDiffusionImageProvider


class ImageProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, ImageProvider] = {
            "google_gemini": GeminiImageProvider(),
            "flux": FluxImageProvider(),
            "stable_diffusion": StableDiffusionImageProvider(),
        }

    def get(self, name: str) -> Optional[ImageProvider]:
        return self._providers.get(name)

    def list_providers(self) -> List[ImageProvider]:
        return list(self._providers.values())


image_provider_registry = ImageProviderRegistry()
