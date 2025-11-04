import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import models before create_all to ensure metadata is populated
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Lightweight init-migration for existing databases (adds new user profile columns)
    try:
        with engine.begin() as conn:
            dname = engine.dialect.name
            if dname == "postgresql":
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100)")
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)")
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram VARCHAR(100)")
            else:
                # Best-effort for SQLite and others; ignore if columns already exist
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN nickname VARCHAR(100)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone VARCHAR(50)")
                except Exception:
                    pass
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN telegram VARCHAR(100)")
                except Exception:
                    pass
    except Exception:
        # Do not block app startup if optional migration fails
        pass


