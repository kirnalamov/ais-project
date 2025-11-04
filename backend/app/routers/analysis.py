from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.scheduling import build_graph_and_cpm


router = APIRouter()


@router.get("/projects/{project_id}/graph", response_model=schemas.GraphAnalysis)
def project_graph(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
    deps = (
        db.query(models.TaskDependency)
        .join(models.Task, models.Task.id == models.TaskDependency.task_id)
        .filter(models.Task.project_id == project_id)
        .all()
    )

    analysis = build_graph_and_cpm(project_id=project_id, tasks=tasks, dependencies=deps)
    return analysis



