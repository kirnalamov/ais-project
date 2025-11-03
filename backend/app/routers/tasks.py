from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from pydantic import BaseModel
from typing import List


router = APIRouter()


@router.get("/", response_model=List[schemas.TaskOut])
def list_tasks(project_id: int = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(models.Task)
        .filter(models.Task.project_id == project_id)
        .order_by(models.Task.id)
        .all()
    )


@router.post("/", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    # Ensure project exists
    project = db.query(models.Project).get(payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task = models.Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/dependencies", response_model=schemas.DependencyOut)
def add_dependency(payload: schemas.DependencyCreate, db: Session = Depends(get_db)):
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
def update_task(task_id: int, payload: TaskUpdatePayload, db: Session = Depends(get_db)):
    task = db.query(models.Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(task, k, v)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}/dependencies", response_model=List[schemas.DependencyOut])
def list_task_dependencies(task_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.TaskDependency)
        .filter(models.TaskDependency.task_id == task_id)
        .order_by(models.TaskDependency.id)
        .all()
    )


class TaskDependenciesPayload(BaseModel):
    depends_on_task_ids: List[int]


@router.put("/{task_id}/dependencies", response_model=List[schemas.DependencyOut])
def replace_task_dependencies(task_id: int, payload: TaskDependenciesPayload, db: Session = Depends(get_db)):
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
    return new_deps



