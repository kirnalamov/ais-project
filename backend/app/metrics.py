from prometheus_client import Counter, Gauge
from sqlalchemy.orm import Session

from . import models


# Общее количество попыток логина
USER_LOGIN_TOTAL = Counter(
    "user_login_total",
    "Total number of user login attempts",
    ("result", "role"),
)


# Число зарегистрированных пользователей по ролям
USERS_REGISTERED_TOTAL = Gauge(
    "users_registered_total",
    "Number of registered users by role",
    ("role",),
)


def update_users_registered_metrics(db: Session) -> None:
    """
    Пересчитывает метрику users_registered_total по всем ролям.
    Можно вызывать при старте приложения и после изменений пользователей.
    """
    for role in models.UserRole:
        count = db.query(models.User).filter(models.User.role == role).count()
        USERS_REGISTERED_TOTAL.labels(role=role.value).set(count)


