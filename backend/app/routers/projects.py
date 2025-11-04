from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import require_roles, get_current_user


router = APIRouter()


@router.get("/", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.Project).order_by(models.Project.id).all()


@router.post("/", response_model=schemas.ProjectOut)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager)),
):
    project = models.Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project



