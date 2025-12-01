import uuid

import requests

from .utils import DEFAULT_PASSWORD, _auth_headers, _login, _login_admin, _url


def test_project_members_added_by_manager_and_admin() -> None:
    """
    Проверяем, что участников проекта могут добавлять не только админы, но и менеджеры проекта,
    а обычные исполнители — не могут.
    """
    admin_token = _login_admin()
    admin_headers = _auth_headers(admin_token)

    suffix = uuid.uuid4().hex[:6]

    # Создаём менеджера и двух исполнителей
    manager_email = f"pm_{suffix}@example.com"
    exec1_email = f"exec1_{suffix}@example.com"
    exec2_email = f"exec2_{suffix}@example.com"

    def _create_user(email: str, role: str) -> int:
        payload = {
            "email": email,
            "full_name": f"{role.capitalize()} {suffix}",
            "password": DEFAULT_PASSWORD,
            "role": role,
        }
        resp = requests.post(_url("/users/"), json=payload, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        return resp.json()["id"]

    _create_user(manager_email, "manager")
    exec1_id = _create_user(exec1_email, "executor")
    exec2_id = _create_user(exec2_email, "executor")

    # Логинимся как менеджер
    manager_token = _login(manager_email, DEFAULT_PASSWORD)
    manager_headers = _auth_headers(manager_token)

    # Менеджер создаёт собственный проект (станет manager_id этого проекта)
    project_payload = {
        "name": f"Manager Project {suffix}",
        "description": "Project created by manager for membership test",
        "budget_plan": 20000,
    }
    resp = requests.post(_url("/projects/"), json=project_payload, headers=manager_headers)
    assert resp.status_code == 200, resp.text
    project_id = resp.json()["id"]

    # Менеджер добавляет exec1 в участники проекта — должно быть успешно
    resp = requests.post(
        _url(f"/projects/{project_id}/members"),
        json={"user_id": exec1_id},
        headers=manager_headers,
    )
    assert resp.status_code == 200, resp.text

    # Обычный исполнитель не может добавлять участников — ожидаем 403
    exec1_token = _login(exec1_email, DEFAULT_PASSWORD)
    exec1_headers = _auth_headers(exec1_token)
    resp = requests.post(
        _url(f"/projects/{project_id}/members"),
        json={"user_id": exec2_id},
        headers=exec1_headers,
    )
    assert resp.status_code == 403

    # Админ может добавить exec2 в проект
    resp = requests.post(
        _url(f"/projects/{project_id}/members"),
        json={"user_id": exec2_id},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    # Проверяем, что в проекте теперь есть оба исполнителя
    resp = requests.get(_url(f"/projects/{project_id}/members"), headers=admin_headers)
    assert resp.status_code == 200, resp.text
    members = resp.json()
    member_ids = {m["user"]["id"] for m in members}
    assert exec1_id in member_ids and exec2_id in member_ids


