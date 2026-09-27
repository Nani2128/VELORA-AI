from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ProviderCapability(BaseModel):
    provider_name: str
    model_name: str
    supports_text_to_image: bool = False
    supports_image_to_image: bool = False
    supports_text_to_video: bool = False
    supports_image_to_video: bool = False
    supported_aspect_ratios: List[str] = []
    max_duration_seconds: int = 0
    requires_paid_tier: bool = False
    metadata: Dict[str, Any] = {}
