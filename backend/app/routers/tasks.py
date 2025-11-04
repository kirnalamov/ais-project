from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.background import BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..events import notify_project
from pydantic import BaseModel
from typing import List


router = APIRouter()


@router.get("/", response_model=List[schemas.TaskOut])
def list_tasks(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Verify access to project
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != models.UserRole.admin:
        if current_user.role == models.UserRole.manager and project.manager_id == current_user.id:
            pass
        else:
            is_member = (
                db.query(models.ProjectMember)
                .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == current_user.id)
                .first()
                is not None
            )
            if not is_member:
                raise HTTPException(status_code=403, detail="Нет доступа к задачам проекта")
    return (
        db.query(models.Task)
        .filter(models.Task.project_id == project_id)
        .order_by(models.Task.id)
        .all()
    )


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check access
    if current_user.role != models.UserRole.admin:
        project = db.query(models.Project).get(task.project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Manager of project has access
        if current_user.role == models.UserRole.manager and project.manager_id == current_user.id:
            pass
        else:
            # Check if user is a member of the project
            is_member = (
                db.query(models.ProjectMember)
                .filter(models.ProjectMember.project_id == task.project_id, models.ProjectMember.user_id == current_user.id)
                .first()
                is not None
            )
            if not is_member:
                raise HTTPException(status_code=403, detail="Нет доступа к задаче")
    
    return task


@router.post("/", response_model=schemas.TaskOut)
def create_task(
    payload: schemas.TaskCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager)),
    background_tasks: BackgroundTasks = None,
):
    # Ensure project exists
    project = db.query(models.Project).get(payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Ensure assignee is project member if provided
    if payload.assignee_id is not None:
        member = (
            db.query(models.ProjectMember)
            .filter(
                models.ProjectMember.project_id == payload.project_id,
                models.ProjectMember.user_id == payload.assignee_id,
            )
            .first()
        )
        if member is None:
            raise HTTPException(status_code=400, detail="Исполнитель не состоит в проекте")

    task = models.Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    if background_tasks is not None:
        assignee_name = None
        if task.assignee_id:
            assignee = db.query(models.User).get(task.assignee_id)
            assignee_name = assignee.full_name if assignee else None
        background_tasks.add_task(
            notify_project,
            task.project_id,
            "task_created",
            user_id=assignee.id if assignee_name else None,
            user_name=assignee_name,
            task_id=task.id,
            task_name=task.name,
            project_name=project.name
        )
    return task


@router.post("/dependencies", response_model=schemas.DependencyOut)
def add_dependency(
    payload: schemas.DependencyCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager)),
):
    if payload.task_id == payload.depends_on_task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")

    # Ensure tasks exist and within same project
    t = db.query(models.Task).get(payload.task_id)
    d = db.query(models.Task).get(payload.depends_on_task_id)
    if not t or not d:
        raise HTTPException(status_code=404, detail="Task not found")
    if t.project_id != d.project_id:
        raise HTTPException(status_code=400, detail="Tasks must belong to the same project")

    dep = models.TaskDependency(**payload.model_dump())
    db.add(dep)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(dep)
    return dep


class TaskUpdatePayload(BaseModel):
    name: str | None = None
    description: str | None = None
    assignee_id: int | None = None
    status: models.TaskStatus | None = None
    priority: models.TaskPriority | None = None
    duration_plan: int | None = None
    deadline: str | None = None


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)

    # Admin has full access to all tasks without restrictions
    is_admin = current_user.role == models.UserRole.admin

    # Permissions: executors can update only their tasks and limited fields
    if not is_admin and current_user.role == models.UserRole.executor:
        if task.assignee_id != current_user.id:
            raise HTTPException(status_code=403, detail="Можно изменять только свои задачи")
        allowed_fields = {"status", "description"}
        data = {k: v for k, v in data.items() if k in allowed_fields}

    # Managers must manage the project or be a member
    if not is_admin and current_user.role == models.UserRole.manager:
        project = db.query(models.Project).get(task.project_id)
        if not project or project.manager_id != current_user.id:
            is_member = (
                db.query(models.ProjectMember)
                .filter(models.ProjectMember.project_id == task.project_id, models.ProjectMember.user_id == current_user.id)
                .first()
                is not None
            )
            if not is_member:
                raise HTTPException(status_code=403, detail="Нет доступа")

    # If assignee_id is being changed, ensure membership
    if "assignee_id" in data and data["assignee_id"] is not None:
        member = (
            db.query(models.ProjectMember)
            .filter(
                models.ProjectMember.project_id == task.project_id,
                models.ProjectMember.user_id == data["assignee_id"],
            )
            .first()
        )
        if member is None:
            raise HTTPException(status_code=400, detail="Исполнитель не состоит в проекте")

    # Enforce dependency rule: a task cannot be started or completed
    # unless all its predecessors are done (skip for admin)
    new_status = data.get("status")
    if not is_admin and new_status in {models.TaskStatus.in_progress, models.TaskStatus.review, models.TaskStatus.done}:
        # Find predecessors
        preds = (
            db.query(models.Task)
            .join(models.TaskDependency, models.TaskDependency.depends_on_task_id == models.Task.id)
            .filter(models.TaskDependency.task_id == task_id)
            .all()
        )
        not_done = [t.id for t in preds if t.status != models.TaskStatus.done]
        if not_done:
            raise HTTPException(
                status_code=400,
                detail="Нельзя начать/завершить задачу, пока предшественники не выполнены",
            )

    # Enforce state transition: only allow moving to DONE from IN_PROGRESS (skip for admin)
    if not is_admin and new_status == models.TaskStatus.done and task.status != models.TaskStatus.in_progress:
        raise HTTPException(
            status_code=400,
            detail="Нельзя завершить задачу, которая не находится в статусе 'in_progress'",
        )

    old_status = task.status.value if hasattr(task.status, 'value') else str(task.status)
    for k, v in data.items():
        setattr(task, k, v)
    db.add(task)
    db.commit()
    db.refresh(task)
    if background_tasks is not None:
        project = db.query(models.Project).get(task.project_id)
        new_status_val = task.status.value if hasattr(task.status, 'value') else str(task.status)
        background_tasks.add_task(
            notify_project,
            task.project_id,
            "task_updated",
            user_id=current_user.id,
            user_name=current_user.full_name,
            task_id=task.id,
            task_name=task.name,
            project_name=project.name if project else None,
            old_status=old_status,
            new_status=new_status_val
        )
    return task


@router.get("/{task_id}/dependencies", response_model=List[schemas.DependencyOut])
def list_task_dependencies(
    task_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return (
        db.query(models.TaskDependency)
        .filter(models.TaskDependency.task_id == task_id)
        .order_by(models.TaskDependency.id)
        .all()
    )


class TaskDependenciesPayload(BaseModel):
    depends_on_task_ids: List[int]


@router.put("/{task_id}/dependencies", response_model=List[schemas.DependencyOut])
def replace_task_dependencies(
    task_id: int,
    payload: TaskDependenciesPayload,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles(models.UserRole.admin, models.UserRole.manager)),
    background_tasks: BackgroundTasks = None,
):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # Ensure all tasks exist and belong to same project
    if payload.depends_on_task_ids:
        count = (
            db.query(models.Task)
            .filter(models.Task.id.in_(payload.depends_on_task_ids))
            .filter(models.Task.project_id == task.project_id)
            .count()
        )
        if count != len(set(payload.depends_on_task_ids)):
            raise HTTPException(status_code=400, detail="Invalid dependency tasks")

    # Remove previous deps
    db.query(models.TaskDependency).filter(models.TaskDependency.task_id == task_id).delete()
    db.flush()
    # Insert new deps
    new_deps = []
    for pid in payload.depends_on_task_ids:
        if pid == task_id:
            continue
        dep = models.TaskDependency(task_id=task_id, depends_on_task_id=pid)
        db.add(dep)
        new_deps.append(dep)
    db.commit()
    for d in new_deps:
        db.refresh(d)
    if background_tasks is not None:
        project = db.query(models.Project).get(task.project_id)
        background_tasks.add_task(
            notify_project,
            task.project_id,
            "deps_updated",
            task_id=task_id,
            task_name=task.name,
            project_name=project.name if project else None
        )
    return new_deps


@router.get("/{task_id}/messages", response_model=List[schemas.TaskMessageOut])
def list_task_messages(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != models.UserRole.admin:
        project = db.query(models.Project).get(task.project_id)
        allowed = False
        if project and project.manager_id == current_user.id:
            allowed = True
        # allow project managers who are members even if not manager_id
        if current_user.role == models.UserRole.manager and not allowed:
            is_member = (
                db.query(models.ProjectMember)
                .filter(models.ProjectMember.project_id == task.project_id, models.ProjectMember.user_id == current_user.id)
                .first()
                is not None
            )
            if is_member:
                allowed = True
        if task.assignee_id == current_user.id:
            allowed = True
        if not allowed:
            raise HTTPException(status_code=403, detail="Нет доступа к чату задачи")
    msgs = (
        db.query(models.TaskMessage)
        .filter(models.TaskMessage.task_id == task_id)
        .order_by(models.TaskMessage.created_at.asc())
        .all()
    )
    return msgs


@router.post("/{task_id}/messages", response_model=schemas.TaskMessageOut)
def send_task_message(
    task_id: int,
    payload: schemas.TaskMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != models.UserRole.admin:
        project = db.query(models.Project).get(task.project_id)
        allowed = False
        if project and project.manager_id == current_user.id:
            allowed = True
        # allow project managers who are members even if not manager_id
        if current_user.role == models.UserRole.manager and not allowed:
            is_member = (
                db.query(models.ProjectMember)
                .filter(models.ProjectMember.project_id == task.project_id, models.ProjectMember.user_id == current_user.id)
                .first()
                is not None
            )
            if is_member:
                allowed = True
        if task.assignee_id == current_user.id:
            allowed = True
        if not allowed:
            raise HTTPException(status_code=403, detail="Нет доступа к чату задачи")
    msg = models.TaskMessage(task_id=task_id, author_id=current_user.id, content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    if background_tasks is not None:
        project = db.query(models.Project).get(task.project_id)
        background_tasks.add_task(
            notify_project,
            task.project_id,
            "message",
            user_id=current_user.id,
            user_name=current_user.full_name,
            task_id=task_id,
            task_name=task.name,
            project_name=project.name if project else None
        )
    return msg



