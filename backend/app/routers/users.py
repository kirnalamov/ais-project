from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_roles, get_password_hash
from ..db import get_db


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


