import os

import requests


# Все тесты ходят в backend, запущенный в Docker
BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
DEFAULT_PASSWORD = "testpassword123"


def _url(path: str) -> str:
    return f"{BASE_URL}{path}"


def _login(email: str, password: str) -> str:
    payload = {"email": email, "password": password}
    resp = requests.post(_url("/auth/login"), json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    return data["access_token"]


def _login_admin() -> str:
    """Получить JWT токен админа через /auth/login."""
    return _login("admin@example.com", "admin")


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


