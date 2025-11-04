from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import verify_password, create_access_token, get_current_user, get_password_hash
from ..db import get_db
from ..services.demo import ensure_user_in_demo_project


router = APIRouter()


class LoginPayload(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: schemas.UserOut


@router.post("/login", response_model=TokenOut)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    token = create_access_token(subject=user.email)
    return TokenOut(access_token=token, user=user)  # type: ignore[arg-type]


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        nickname=payload.nickname,
        phone=payload.phone,
        telegram=payload.telegram,
        role=models.UserRole.executor,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_user_in_demo_project(db, user)
    return user


