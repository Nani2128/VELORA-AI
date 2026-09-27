import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.models.asset import Asset
from backend.app.services.storage_service import storage_service


class AssetService:
    @staticmethod
    def create_asset_record(
        db: Session,
        user_id: uuid.UUID,
        asset_type: str,
        source: str,
        storage_key: str,
        mime_type: str,
        size_bytes: int,
        project_id: Optional[uuid.UUID] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        duration_seconds: Optional[float] = None,
        metadata: Optional[dict] = None,
    ) -> Asset:
        asset = Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            project_id=project_id,
            type=asset_type,
            source=source,
            storage_key=storage_key,
            mime_type=mime_type,
            size_bytes=size_bytes,
            width=width,
            height=height,
            duration_seconds=duration_seconds,
            metadata_json=metadata or {},
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def get_user_assets(
        db: Session,
        user_id: uuid.UUID,
        asset_type: Optional[str] = None,
        project_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Asset]:
        query = db.query(Asset).filter(Asset.user_id == user_id)
        if asset_type:
            query = query.filter(Asset.type == asset_type.upper())
        if project_id:
            query = query.filter(Asset.project_id == project_id)
        return query.order_by(Asset.created_at.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def get_asset_by_id(db: Session, asset_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Asset]:
        return db.query(Asset).filter(Asset.id == asset_id, Asset.user_id == user_id).first()


asset_service = AssetService()
