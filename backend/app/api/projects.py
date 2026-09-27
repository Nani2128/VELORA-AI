import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from backend.app.services.project_service import project_service

router = APIRouter(prefix="/projects", tags=["Projects"])
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    return project_service.get_projects(db, DEFAULT_USER_ID)


@router.post("", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    proj = project_service.create_project(db, DEFAULT_USER_ID, data)
    return ProjectResponse(
        id=proj.id,
        user_id=proj.user_id,
        name=proj.name,
        description=proj.description,
        cover_asset_id=proj.cover_asset_id,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        asset_count=0,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: uuid.UUID, db: Session = Depends(get_db)):
    proj = project_service.get_project(db, project_id, DEFAULT_USER_ID)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: uuid.UUID, data: ProjectUpdate, db: Session = Depends(get_db)):
    proj = project_service.get_project(db, project_id, DEFAULT_USER_ID)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_service.update_project(db, proj, data)


@router.delete("/{project_id}")
def delete_project(project_id: uuid.UUID, db: Session = Depends(get_db)):
    proj = project_service.get_project(db, project_id, DEFAULT_USER_ID)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    project_service.delete_project(db, proj)
    return {"status": "success", "deleted_id": str(project_id)}
