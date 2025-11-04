from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db, SessionLocal
from .routers import projects, tasks, analysis, auth as auth_router, users as users_router, events as events_router
from . import models
from .auth import get_password_hash


app = FastAPI(title="Корпоративный планировщик задач")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    # Seed default users if none exist
    db = SessionLocal()
    try:
        has_users = db.query(models.User).first() is not None
        if not has_users:
            admin = models.User(
                email="admin@example.com",
                full_name="Администратор",
                role=models.UserRole.admin,
                password_hash=get_password_hash("admin"),
            )
            manager = models.User(
                email="manager@example.com",
                full_name="Проектный менеджер",
                role=models.UserRole.manager,
                password_hash=get_password_hash("manager"),
            )
            executor = models.User(
                email="executor@example.com",
                full_name="Исполнитель",
                role=models.UserRole.executor,
                password_hash=get_password_hash("executor"),
            )
            db.add_all([admin, manager, executor])
            db.commit()
    finally:
        db.close()


app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(users_router.router, prefix="/users", tags=["users"])
app.include_router(events_router.router, prefix="/events", tags=["events"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])


@app.get("/")
def root() -> dict:
    return {"status": "ok"}



