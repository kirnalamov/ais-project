import os

import requests


# Все тесты ходят в backend, запущенный в Docker
BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")


def _url(path: str) -> str:
    return f"{BASE_URL}{path}"


def test_root_ok_docker() -> None:
    resp = requests.get(_url("/"))
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_openapi_available_docker() -> None:
    resp = requests.get(_url("/openapi.json"))
    assert resp.status_code == 200
    data = resp.json()
    assert "paths" in data
    assert "components" in data


def test_auth_login_admin_docker() -> None:
    """Интеграционный тест: логинимся в backend, запущенный в Docker."""
    payload = {"email": "admin@example.com", "password": "admin"}
    resp = requests.post(_url("/auth/login"), json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"

