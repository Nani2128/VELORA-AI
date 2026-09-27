import os
import uuid
from abc import ABC, abstractmethod
from typing import Optional
from backend.app.core.config import settings


class StorageService(ABC):
    @abstractmethod
    async def put(self, key: str, data: bytes, mime_type: str) -> str:
        pass

    @abstractmethod
    async def get(self, key: str) -> Optional[bytes]:
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        pass

    @abstractmethod
    def get_public_url(self, key: str) -> str:
        pass


class LocalStorageService(StorageService):
    def __init__(self, base_dir: str = "uploads"):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    async def put(self, key: str, data: bytes, mime_type: str) -> str:
        file_path = os.path.join(self.base_dir, key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(data)
        return key

    async def get(self, key: str) -> Optional[bytes]:
        file_path = os.path.join(self.base_dir, key)
        if not os.path.exists(file_path):
            return None
        with open(file_path, "rb") as f:
            return f.read()

    async def delete(self, key: str) -> bool:
        file_path = os.path.join(self.base_dir, key)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    def get_public_url(self, key: str) -> str:
        return f"/uploads/{key}"


storage_service = LocalStorageService(settings.LOCAL_STORAGE_DIR)
