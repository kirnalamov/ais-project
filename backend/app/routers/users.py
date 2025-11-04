from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_roles, get_password_hash, get_current_user
from ..db import get_db
from ..services.demo import ensure_user_in_demo_project


router = APIRouter()


@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin)),
):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("/", response_model=schemas.UserOut)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin)),
):
    exists = db.query(models.User).filter(models.User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_user_in_demo_project(db, user)
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin)),
):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.password_hash = get_password_hash(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin)),
):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return {"status": "ok"}


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        current_user.password_hash = get_password_hash(data.pop("password"))
    # Disallow role change via /me
    data.pop("role", None)
    for k, v in data.items():
        setattr(current_user, k, v)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/search")
def search_users(q: str, db: Session = Depends(get_db), _: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager))):
    ql = f"%{q.lower()}%"
    users = (
        db.query(models.User)
        .filter((models.User.email.ilike(ql)) | (models.User.full_name.ilike(ql)) | (models.User.nickname.ilike(ql)))
        .order_by(models.User.id)
        .limit(20)
        .all()
    )
    # return minimal public fields
    return [
        {"id": u.id, "email": u.email, "full_name": u.full_name, "nickname": u.nickname, "role": u.role}
        for u in users
    ]


@router.get("/me/stats")
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get current user statistics and tasks"""
    # Get all tasks assigned to me
    my_tasks = db.query(models.Task).filter(models.Task.assignee_id == current_user.id).all()
    
    # Count by status
    status_counts = {
        "backlog": 0,
        "in_progress": 0,
        "review": 0,
        "done": 0
    }
    for task in my_tasks:
        status_counts[task.status.value] += 1
    
    # Get projects where I'm a member or manager
    if current_user.role == models.UserRole.admin:
        my_projects = db.query(models.Project).all()
    elif current_user.role == models.UserRole.manager:
        my_projects = (
            db.query(models.Project)
            .outerjoin(models.ProjectMember, models.ProjectMember.project_id == models.Project.id)
            .filter((models.Project.manager_id == current_user.id) | (models.ProjectMember.user_id == current_user.id))
            .distinct()
            .all()
        )
    else:
        my_projects = (
            db.query(models.Project)
            .join(models.ProjectMember, models.ProjectMember.project_id == models.Project.id)
            .filter(models.ProjectMember.user_id == current_user.id)
            .all()
        )
    
    # Serialize tasks with project info
    tasks_data = []
    for task in my_tasks:
        project = db.query(models.Project).get(task.project_id)
        tasks_data.append({
            "id": task.id,
            "name": task.name,
            "status": task.status.value,
            "priority": task.priority.value,
            "project_id": task.project_id,
            "project_name": project.name if project else None,
            "duration_plan": task.duration_plan,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
        })
    
    # Serialize projects
    projects_data = []
    for project in my_projects:
        # Count tasks in project
        project_tasks = db.query(models.Task).filter(models.Task.project_id == project.id).count()
        projects_data.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "tasks_count": project_tasks,
            "manager_id": project.manager_id,
        })
    
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "nickname": current_user.nickname,
            "phone": current_user.phone,
            "telegram": current_user.telegram,
        },
        "stats": {
            "total_tasks": len(my_tasks),
            "tasks_by_status": status_counts,
            "total_projects": len(my_projects),
        },
        "tasks": tasks_data,
        "projects": projects_data,
    }


