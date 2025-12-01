import random
import uuid
from typing import Dict, List

import requests

from .utils import DEFAULT_PASSWORD, _auth_headers, _login, _login_admin, _url


def test_mass_flow_many_users_projects_tasks() -> None:
    """
    Большой интеграционный сценарий:
    - создаём 100 пользователей с разными ролями
    - создаём несколько проектов и равномерно раскидываем менеджеров/исполнителей
    - создаём ~1000 задач по проектам с зависимостями
    - отправляем сообщения в чаты задач
    - меняем статусы и редактируем задачи от имени разных пользователей
    """
    admin_token = _login_admin()
    admin_headers = _auth_headers(admin_token)

    suffix = uuid.uuid4().hex[:6]

    # 1) 100 пользователей с ролями:
    #    10% admin, 20% manager, остальные executor
    users: List[Dict] = []
    for i in range(100):
        if i < 10:
            role = "admin"
        elif i < 30:
            role = "manager"
        else:
            role = "executor"
        email = f"bulk_{suffix}_{i}@example.com"
        payload = {
            "email": email,
            "full_name": f"Bulk User {i} ({role})",
            "password": DEFAULT_PASSWORD,
            "role": role,
        }
        resp = requests.post(_url("/users/"), json=payload, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        users.append({"id": data["id"], "email": email, "role": role})

    managers = [u for u in users if u["role"] == "manager"]
    executors = [u for u in users if u["role"] == "executor"]
    assert managers and executors

    # 2) Несколько проектов, менеджеры распределены по кругу
    projects: List[Dict] = []
    num_projects = 5
    for i in range(num_projects):
        manager = managers[i % len(managers)]
        payload = {
            "name": f"Bulk Project {suffix}-{i}",
            "description": "Project created from mass integration test",
            "budget_plan": 50000 + i * 1000,
            "manager_id": manager["id"],
        }
        resp = requests.post(_url("/projects/"), json=payload, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        proj = resp.json()
        projects.append({"id": proj["id"], "manager": manager})

    # 3) Добавляем исполнителей в участники проектов (по нескольким на каждый проект)
    project_members: Dict[int, List[Dict]] = {p["id"]: [] for p in projects}
    for idx, exec_user in enumerate(executors):
        proj = projects[idx % len(projects)]
        resp = requests.post(
            _url(f"/projects/{proj['id']}/members"),
            json={"user_id": exec_user["id"]},
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        project_members[proj["id"]].append(exec_user)

    # 4) Создаём ~1000 задач по проектам
    all_tasks: List[Dict] = []
    tasks_per_project = 200  # 5 * 200 = 1000
    for proj in projects:
        pid = proj["id"]
        members = project_members[pid]
        assert members  # у каждого проекта есть хотя бы один исполнитель
        for i in range(tasks_per_project):
            assignee = members[i % len(members)]
            payload = {
                "name": f"Task {suffix}-{pid}-{i}",
                "description": "Mass test task",
                "project_id": pid,
                "duration_plan": random.randint(1, 10),
                "assignee_id": assignee["id"],
            }
            resp = requests.post(_url("/tasks/"), json=payload, headers=admin_headers)
            assert resp.status_code == 200, resp.text
            task = resp.json()
            task["assignee"] = assignee
            all_tasks.append(task)

    # 5) Добавляем зависимости внутри каждого проекта (цепочки + разветвления)
    tasks_by_project: Dict[int, List[Dict]] = {}
    for t in all_tasks:
        tasks_by_project.setdefault(t["project_id"], []).append(t)

    for pid, tasks in tasks_by_project.items():
        tasks_sorted = sorted(tasks, key=lambda x: x["id"])
        # Простая цепочка: каждая следующая зависит от предыдущей
        for prev, curr in zip(tasks_sorted, tasks_sorted[1:]):
            dep_payload = {
                "task_id": curr["id"],
                "depends_on_task_id": prev["id"],
            }
            resp = requests.post(
                _url("/tasks/dependencies"),
                json=dep_payload,
                headers=admin_headers,
            )
            assert resp.status_code == 200, resp.text
        # Дополнительные "длинные" зависимости через 5 задач
        for i in range(5, len(tasks_sorted), 20):
            dep_payload = {
                "task_id": tasks_sorted[i]["id"],
                "depends_on_task_id": tasks_sorted[i - 5]["id"],
            }
            resp = requests.post(
                _url("/tasks/dependencies"),
                json=dep_payload,
                headers=admin_headers,
            )
            assert resp.status_code == 200, resp.text

    # 6) Отправляем сообщения в чаты для первых 20 задач
    for task in all_tasks[:20]:
        msg_payload = {"content": f"Hello from mass test for task {task['id']}"}
        resp = requests.post(
            _url(f"/tasks/{task['id']}/messages"),
            json=msg_payload,
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        msg = resp.json()
        assert msg["task_id"] == task["id"]

    # 7) Меняем статусы и редактируем задачи от имени исполнителя
    # Берём одного исполнителя и несколько его задач без предшественников (первые в списке проекта)
    sample_exec = executors[0]
    exec_token = _login(sample_exec["email"], DEFAULT_PASSWORD)
    exec_headers = _auth_headers(exec_token)

    # Выберем первые 3 задачи первого проекта, назначенные на этого исполнителя
    first_project_id = projects[0]["id"]
    candidate_tasks = [
        t for t in tasks_by_project[first_project_id] if t["assignee"]["id"] == sample_exec["id"]
    ][:3]

    for t in candidate_tasks:
        # executor может менять только status и description, соблюдая правила переходов.
        # Возможна ошибка 400, если есть неудовлетворённые зависимости — это корректно.
        # 1) backlog -> in_progress
        resp = requests.patch(
            _url(f"/tasks/{t['id']}"),
            json={"status": "in_progress", "description": "Work started"},
            headers=exec_headers,
        )
        if resp.status_code == 400:
            # Предшественники не выполнены — бизнес-правило сработало.
            assert "Нельзя начать/завершить задачу" in resp.text
            continue
        assert resp.status_code == 200, resp.text
        # 2) in_progress -> done
        resp = requests.patch(
            _url(f"/tasks/{t['id']}"),
            json={"status": "done", "description": "Work finished"},
            headers=exec_headers,
        )
        if resp.status_code == 400:
            # Возможное нарушение правил перехода — тоже валидный сценарий.
            assert "Нельзя завершить задачу" in resp.text or "Нельзя начать/завершить задачу" in resp.text
        else:
            assert resp.status_code == 200, resp.text

    # 8) Редактируем несколько задач от имени админа (смена имени и длительности)
    for t in all_tasks[:10]:
        new_name = f"{t['name']} [edited]"
        resp = requests.patch(
            _url(f"/tasks/{t['id']}"),
            json={"name": new_name, "duration_plan": t["duration_plan"] + 1},
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text


