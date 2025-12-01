import uuid

import requests

from .utils import DEFAULT_PASSWORD, _auth_headers, _login, _login_admin, _url


def test_task_chat_messages_flow() -> None:
    """
    Тестируем обмен сообщениями в чате задачи:
    - создаём пользователя-исполнителя и проект
    - создаём задачу и назначаем на исполнителя
    - отправляем несколько сообщений (от админа и исполнителя)
    - проверяем, что сообщения возвращаются в правильном порядке
    """
    admin_token = _login_admin()
    admin_headers = _auth_headers(admin_token)

    suffix = uuid.uuid4().hex[:6]

    # Пользователь-исполнитель
    email = f"chat_exec_{suffix}@example.com"
    user_payload = {
        "email": email,
        "full_name": f"Chat Executor {suffix}",
        "password": DEFAULT_PASSWORD,
        "role": "executor",
    }
    resp = requests.post(_url("/users/"), json=user_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    user = resp.json()
    user_id = user["id"]

    # Проект
    project_payload = {
        "name": f"Chat Project {suffix}",
        "description": "Project for chat test",
        "budget_plan": 1000,
    }
    resp = requests.post(_url("/projects/"), json=project_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    project_id = resp.json()["id"]

    # Добавляем исполнителя в проект
    resp = requests.post(
        _url(f"/projects/{project_id}/members"),
        json={"user_id": user_id},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    # Задача
    task_payload = {
        "name": f"Chat Task {suffix}",
        "description": "Task for chat test",
        "project_id": project_id,
        "duration_plan": 3,
        "assignee_id": user_id,
    }
    resp = requests.post(_url("/tasks/"), json=task_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    task = resp.json()
    task_id = task["id"]

    # Логин исполнителя
    exec_token = _login(email, DEFAULT_PASSWORD)
    exec_headers = _auth_headers(exec_token)

    # Сообщения: одно от админа, два от исполнителя
    messages = [
        ("Admin says hi", admin_headers),
        ("Executor answer 1", exec_headers),
        ("Executor answer 2", exec_headers),
    ]
    for content, headers in messages:
        msg_payload = {"content": content}
        resp = requests.post(
            _url(f"/tasks/{task_id}/messages"),
            json=msg_payload,
            headers=headers,
        )
        assert resp.status_code == 200, resp.text

    # Проверяем список сообщений
    resp = requests.get(_url(f"/tasks/{task_id}/messages"), headers=exec_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 3
    contents = [m["content"] for m in data]
    assert contents == [m[0] for m in messages]


def test_task_status_transitions_with_dependencies() -> None:
    """
    Тестируем бизнес-правила по смене статусов задач с зависимостями:
    - задача B зависит от задачи A
    - исполнитель не может начать B, пока A не завершена
    - после завершения A статус B можно перевести в in_progress и done
    """
    admin_token = _login_admin()
    admin_headers = _auth_headers(admin_token)

    suffix = uuid.uuid4().hex[:6]

    # Исполнитель
    email = f"status_exec_{suffix}@example.com"
    user_payload = {
        "email": email,
        "full_name": f"Status Executor {suffix}",
        "password": DEFAULT_PASSWORD,
        "role": "executor",
    }
    resp = requests.post(_url("/users/"), json=user_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    user_id = resp.json()["id"]

    # Проект
    project_payload = {
        "name": f"Status Project {suffix}",
        "description": "Project for status test",
        "budget_plan": 5000,
    }
    resp = requests.post(_url("/projects/"), json=project_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    project_id = resp.json()["id"]

    # Участник проекта
    resp = requests.post(
        _url(f"/projects/{project_id}/members"),
        json={"user_id": user_id},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    # Задача A (предшественник)
    task_a_payload = {
        "name": f"Task A {suffix}",
        "project_id": project_id,
        "duration_plan": 2,
        "assignee_id": user_id,
    }
    resp = requests.post(_url("/tasks/"), json=task_a_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    task_a_id = resp.json()["id"]

    # Задача B (зависит от A)
    task_b_payload = {
        "name": f"Task B {suffix}",
        "project_id": project_id,
        "duration_plan": 3,
        "assignee_id": user_id,
    }
    resp = requests.post(_url("/tasks/"), json=task_b_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    task_b_id = resp.json()["id"]

    # Зависимость B -> A
    dep_payload = {"task_id": task_b_id, "depends_on_task_id": task_a_id}
    resp = requests.post(_url("/tasks/dependencies"), json=dep_payload, headers=admin_headers)
    assert resp.status_code == 200, resp.text

    # Логин исполнителя
    exec_token = _login(email, DEFAULT_PASSWORD)
    exec_headers = _auth_headers(exec_token)

    # Пытаемся начать B до завершения A — должно быть 400
    resp = requests.patch(
        _url(f"/tasks/{task_b_id}"),
        json={"status": "in_progress"},
        headers=exec_headers,
    )
    assert resp.status_code == 400
    assert "Нельзя начать/завершить задачу" in resp.text

    # Переводим A в in_progress -> done
    resp = requests.patch(
        _url(f"/tasks/{task_a_id}"),
        json={"status": "in_progress"},
        headers=exec_headers,
    )
    assert resp.status_code == 200, resp.text
    resp = requests.patch(
        _url(f"/tasks/{task_a_id}"),
        json={"status": "done"},
        headers=exec_headers,
    )
    assert resp.status_code == 200, resp.text

    # Теперь можно начать и завершить B
    resp = requests.patch(
        _url(f"/tasks/{task_b_id}"),
        json={"status": "in_progress"},
        headers=exec_headers,
    )
    assert resp.status_code == 200, resp.text
    resp = requests.patch(
        _url(f"/tasks/{task_b_id}"),
        json={"status": "done"},
        headers=exec_headers,
    )
    assert resp.status_code == 200, resp.text


