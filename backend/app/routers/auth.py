from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import verify_password, create_access_token, get_current_user
from ..db import get_db


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


