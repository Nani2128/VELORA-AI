import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.models.project import Project
from backend.app.models.asset import Asset
from backend.app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    @staticmethod
    def get_projects(db: Session, user_id: uuid.UUID) -> List[dict]:
        projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).all()
        results = []
        for p in projects:
            asset_count = db.query(Asset).filter(Asset.project_id == p.id).count()
            results.append({
                "id": p.id,
                "user_id": p.user_id,
                "name": p.name,
                "description": p.description,
                "cover_asset_id": p.cover_asset_id,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "asset_count": asset_count,
            })
        return results

    @staticmethod
    def create_project(db: Session, user_id: uuid.UUID, data: ProjectCreate) -> Project:
        project = Project(
            id=uuid.uuid4(),
            user_id=user_id,
            name=data.name,
            description=data.description,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def get_project(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Project]:
        return db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()

    @staticmethod
    def update_project(db: Session, project: Project, data: ProjectUpdate) -> Project:
        if data.name is not None:
            project.name = data.name
        if data.description is not None:
            project.description = data.description
        if data.cover_asset_id is not None:
            project.cover_asset_id = data.cover_asset_id
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete_project(db: Session, project: Project) -> None:
        db.delete(project)
        db.commit()


project_service = ProjectService()
