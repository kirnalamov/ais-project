from typing import List

from fastapi import APIRouter, Depends, HTTPException
from starlette.background import BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import require_roles, get_current_user


router = APIRouter()


@router.get("/", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Project)
    if current_user.role == models.UserRole.admin:
        return q.order_by(models.Project.id).all()
    # Managers: see managed or where member
    if current_user.role == models.UserRole.manager:
        return (
            q.outerjoin(models.ProjectMember, models.ProjectMember.project_id == models.Project.id)
            .filter((models.Project.manager_id == current_user.id) | (models.ProjectMember.user_id == current_user.id))
            .order_by(models.Project.id)
            .all()
        )
    # Executors: only where member
    return (
        q.join(models.ProjectMember, models.ProjectMember.project_id == models.Project.id)
        .filter(models.ProjectMember.user_id == current_user.id)
        .order_by(models.Project.id)
        .all()
    )


@router.post("/", response_model=schemas.ProjectOut)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager)),
    background_tasks: BackgroundTasks = None,
):
    data = payload.model_dump()
    if current_user.role == models.UserRole.manager and not data.get("manager_id"):
        data["manager_id"] = current_user.id
    project = models.Project(**data)
    db.add(project)
    db.commit()
    db.refresh(project)
    if background_tasks is not None:
        from ..events import notify_project
        background_tasks.add_task(notify_project, project.id, "project_created")
    return project


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == models.UserRole.admin:
        return project
    if current_user.role == models.UserRole.manager and project.manager_id == current_user.id:
        return project
    is_member = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == current_user.id)
        .first()
        is not None
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    return project


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Permissions: admin or manager of this project
    if current_user.role != models.UserRole.admin and project.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    data = payload.model_dump(exclude_unset=True)
    # Only admin can change manager_id
    if current_user.role != models.UserRole.admin:
        data.pop("manager_id", None)
    for k, v in data.items():
        setattr(project, k, v)
    db.add(project)
    db.commit()
    db.refresh(project)
    if background_tasks is not None:
        from ..events import notify_project
        background_tasks.add_task(notify_project, project.id, "project_updated")
    return project


@router.get("/{project_id}/members", response_model=List[schemas.ProjectMemberOut])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Access if admin, manager of project, or project member
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != models.UserRole.admin and project.manager_id != current_user.id:
        is_member = (
            db.query(models.ProjectMember)
            .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == current_user.id)
            .first()
            is not None
        )
        if not is_member:
            raise HTTPException(status_code=403, detail="Нет доступа")
    members = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id)
        .order_by(models.ProjectMember.id)
        .all()
    )
    return members


@router.post("/{project_id}/members", response_model=schemas.ProjectMemberOut)
def add_member(
    project_id: int,
    payload: schemas.ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not (
        current_user.role == models.UserRole.admin
        or (current_user.role == models.UserRole.manager and project.manager_id == current_user.id)
    ):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    # Ensure user exists
    user = db.query(models.User).get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Upsert-like
    exists = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == payload.user_id)
        .first()
    )
    if exists:
        return exists
    member = models.ProjectMember(project_id=project_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    if background_tasks is not None:
        from ..events import notify_project
        background_tasks.add_task(notify_project, project_id, "member_added")
    return member


@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not (
        current_user.role == models.UserRole.admin
        or (current_user.role == models.UserRole.manager and project.manager_id == current_user.id)
    ):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    deleted = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == user_id)
        .delete()
    )
    if deleted:
        db.commit()
        if background_tasks is not None:
            from ..events import notify_project
            background_tasks.add_task(notify_project, project_id, "member_removed")
    return {"status": "ok"}



