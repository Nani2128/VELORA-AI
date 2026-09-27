from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ProviderResult(BaseModel):
    provider_operation_id: Optional[str] = None
    status: str  # "COMPLETED", "PROCESSING", "FAILED"
    asset_data: Optional[bytes] = None
    asset_mime_type: Optional[str] = None
    asset_width: Optional[int] = None
    asset_height: Optional[int] = None
    duration_seconds: Optional[float] = None
    metadata: Dict[str, Any] = {}
    error: Optional[Dict[str, Any]] = None


class BaseAIProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        pass
