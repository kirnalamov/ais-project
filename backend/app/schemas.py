from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel

from .models import UserRole, TaskStatus, TaskPriority, DependencyType


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: UserRole


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[date] = None
    customer: Optional[str] = None
    manager_id: Optional[int] = None
    budget_plan: Optional[float] = None


class ProjectOut(ProjectCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: int
    assignee_id: Optional[int] = None
    status: TaskStatus = TaskStatus.backlog
    priority: TaskPriority = TaskPriority.medium
    duration_plan: int
    deadline: Optional[date] = None


class TaskOut(TaskCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DependencyCreate(BaseModel):
    task_id: int
    depends_on_task_id: int
    dependency_type: DependencyType = DependencyType.blocks


class DependencyOut(DependencyCreate):
    id: int

    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: int
    name: str
    duration: int
    es: int
    ef: int
    ls: int
    lf: int
    slack: int
    is_critical: bool
    status: TaskStatus


class GraphEdge(BaseModel):
    source: int
    target: int
    dependency_type: DependencyType
    redundant: bool = False


class GraphAnalysis(BaseModel):
    project_id: int
    duration: int
    critical_path: List[int]
    nodes: List[GraphNode]
    edges: List[GraphEdge]



