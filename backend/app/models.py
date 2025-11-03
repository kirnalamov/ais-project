from datetime import datetime, date
from enum import Enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    DECIMAL,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .db import Base


class UserRole(str, Enum):
    admin = "admin"
    manager = "manager"
    executor = "executor"


class TaskStatus(str, Enum):
    backlog = "backlog"
    in_progress = "in_progress"
    review = "review"
    done = "done"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class DependencyType(str, Enum):
    blocks = "blocks"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)

    projects_managed = relationship("Project", back_populates="manager")
    tasks_assigned = relationship("Task", back_populates="assignee")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    customer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    budget_plan = Column(DECIMAL(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    manager = relationship("User", back_populates="projects_managed")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus), default=TaskStatus.backlog, nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(SAEnum(TaskPriority), default=TaskPriority.medium, nullable=False)
    duration_plan: Mapped[int] = mapped_column(Integer, nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks_assigned")
    dependencies = relationship("TaskDependency", back_populates="task", foreign_keys="TaskDependency.task_id", cascade="all, delete-orphan")
    dependents = relationship("TaskDependency", back_populates="depends_on_task", foreign_keys="TaskDependency.depends_on_task_id", cascade="all, delete-orphan")
    activities = relationship("ActivityLog", back_populates="task", cascade="all, delete-orphan")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    depends_on_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    dependency_type: Mapped[DependencyType] = mapped_column(SAEnum(DependencyType), default=DependencyType.blocks, nullable=False)

    task = relationship("Task", back_populates="dependencies", foreign_keys=[task_id])
    depends_on_task = relationship("Task", back_populates="dependents", foreign_keys=[depends_on_task_id])


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    task = relationship("Task", back_populates="activities")



