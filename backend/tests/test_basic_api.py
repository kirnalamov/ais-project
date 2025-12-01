import requests

from .utils import _url, _login_admin


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
    token = _login_admin()
    assert isinstance(token, str) and len(token) > 0


