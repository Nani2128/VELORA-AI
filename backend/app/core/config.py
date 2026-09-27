from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "VELORA AI Backend"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # Database & Redis
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/velora"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Provider Secrets (Kept strictly server-side)
    GEMINI_API_KEY: str = ""
    
    # Storage Configuration
    STORAGE_PROVIDER: str = "local"  # "local" | "s3"
    STORAGE_BUCKET: str = "velora-assets"
    STORAGE_ENDPOINT: str = ""
    LOCAL_STORAGE_DIR: str = "uploads"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ais-dev-4jfnl6qfmvx3d6t4vqetfi-867592327765.asia-east1.run.app"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
