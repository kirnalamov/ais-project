import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List

import pytest
import requests

from .utils import DEFAULT_PASSWORD, _auth_headers, _login, _login_admin, _url


@pytest.mark.load
def test_increasing_load_until_first_failure() -> None:
    """
    Нагрузочный тест "по‑настоящему":
    - создаём пул пользователей / проектов / задач
    - постепенно повышаем конкуренцию и частоту запросов
    - в каждом шаге одновременно:
      * логинимся,
      * создаём новых пользователей / проекты / задачи,
      * шлём сообщения в задачи,
      * вызываем анализ графа проекта.
    Тест останавливается и падает при первой серьёзной ошибке (5xx или исключение).

    Тест предназначен для ручного запуска: pytest -m load
    """
    admin_token = _login_admin()
    admin_headers = _auth_headers(admin_token)

    suffix = f"{int(time.time()) % 10000:x}"

    # Базовый набор менеджеров и исполнителей
    managers: List[Dict] = []
    executors: List[Dict] = []

    for i in range(3):
        email = f"load_pm_{suffix}_{i}@example.com"
        payload = {
            "email": email,
            "full_name": f"Load Manager {i}",
            "password": DEFAULT_PASSWORD,
            "role": "manager",
        }
        resp = requests.post(_url("/users/"), json=payload, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        managers.append({"id": data["id"], "email": email})

    for i in range(10):
        email = f"load_exec_{suffix}_{i}@example.com"
        payload = {
            "email": email,
            "full_name": f"Load Executor {i}",
            "password": DEFAULT_PASSWORD,
            "role": "executor",
        }
        resp = requests.post(_url("/users/"), json=payload, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        executors.append({"id": data["id"], "email": email})

    # Проекты и начальные задачи
    projects: List[Dict] = []
    tasks: List[Dict] = []
    project_members: Dict[int, List[Dict]] = {}

    for i, manager in enumerate(managers):
        pm_token = _login(manager["email"], DEFAULT_PASSWORD)
        pm_headers = _auth_headers(pm_token)
        proj_payload = {
            "name": f"Load Project {suffix}-{i}",
            "description": "Project for realistic load test",
            "budget_plan": 50000 + i * 1000,
        }
        resp = requests.post(_url("/projects/"), json=proj_payload, headers=pm_headers)
        assert resp.status_code == 200, resp.text
        project = resp.json()
        projects.append(project)

        # Добавляем несколько исполнителей в участники проекта
        members_for_project: List[Dict] = []
        for exec_user in random.sample(executors, k=3):
            resp = requests.post(
                _url(f"/projects/{project['id']}/members"),
                json={"user_id": exec_user["id"]},
                headers=pm_headers,
            )
            assert resp.status_code == 200, resp.text
            members_for_project.append(exec_user)
        project_members[project["id"]] = members_for_project

        # По несколько базовых задач на проект — назначаем только на участников проекта
        for j in range(5):
            assignee = random.choice(members_for_project)
            task_payload = {
                "name": f"Base Task {suffix}-{i}-{j}",
                "project_id": project["id"],
                "duration_plan": random.randint(1, 8),
                "assignee_id": assignee["id"],
            }
            resp = requests.post(_url("/tasks/"), json=task_payload, headers=pm_headers)
            assert resp.status_code == 200, resp.text
            task = resp.json()
            task["project"] = project
            tasks.append(task)

    total_requests = 0

    def worker(step: int) -> None:
        nonlocal total_requests
        op = random.random()
        # 0–0.2: логин
        if op < 0.2:
            user = random.choice(executors + managers)
            _ = _login(user["email"], DEFAULT_PASSWORD)
        # 0.2–0.4: создание нового пользователя админом
        elif op < 0.4:
            email = f"load_mix_{suffix}_{uuid4_hex()}.example.com"
            role = random.choice(["manager", "executor"])
            payload = {
                "email": email,
                "full_name": f"Load Mixed {role}",
                "password": DEFAULT_PASSWORD,
                "role": role,
            }
            resp = requests.post(_url("/users/"), json=payload, headers=admin_headers)
            assert resp.status_code < 500, resp.text
        # 0.4–0.6: создание задачи + опциональная зависимость
        elif op < 0.6:
            project = random.choice(projects)
            members = project_members.get(project["id"]) or executors
            assignee = random.choice(members)
            payload = {
                "name": f"Load Step{step} Task {uuid4_hex()[:4]}",
                "project_id": project["id"],
                "duration_plan": random.randint(1, 12),
                "assignee_id": assignee["id"],
            }
            resp = requests.post(_url("/tasks/"), json=payload, headers=admin_headers)
            assert resp.status_code < 500, resp.text
            task = resp.json()
            tasks.append(task)
            # иногда добавляем зависимость
            if tasks and random.random() < 0.5:
                other = random.choice(tasks)
                if other["id"] != task["id"] and other["project_id"] == task["project_id"]:
                    dep_payload = {
                        "task_id": task["id"],
                        "depends_on_task_id": other["id"],
                    }
                    resp = requests.post(
                        _url("/tasks/dependencies"),
                        json=dep_payload,
                        headers=admin_headers,
                    )
                    # 4xx возможны при дублировании — главное, чтобы не было 5xx
                    assert resp.status_code < 500, resp.text
        # 0.6–0.8: сообщения в чат задач
        elif op < 0.8 and tasks:
            task = random.choice(tasks)
            msg_payload = {"content": f"Load ping step={step} task={task['id']}"}
            # половину сообщений шлём от админа, половину от случайного исполнителя
            headers = (
                admin_headers
                if random.random() < 0.5
                else _auth_headers(_login(random.choice(executors)["email"], DEFAULT_PASSWORD))
            )
            resp = requests.post(
                _url(f"/tasks/{task['id']}/messages"),
                json=msg_payload,
                headers=headers,
            )
            assert resp.status_code < 500, resp.text
        # 0.8–1.0: анализ графа проекта (тяжёлый запрос)
        else:
            project = random.choice(projects)
            resp = requests.get(
                _url(f"/analysis/projects/{project['id']}/graph"),
                headers=admin_headers,
                timeout=15,
            )
            assert resp.status_code < 500, resp.text

        total_requests += 1

    def uuid4_hex() -> str:
        # Локальная функция, чтобы не тянуть uuid наверх файла
        import uuid

        return uuid.uuid4().hex

    # Бесконечный раунд‑робин по фазам нагрузки.
    # Тест нужно запускать вручную и останавливать по Ctrl+C,
    # он завершится сам только при первой серьёзной ошибке.
    phase = 0
    while True:  # noqa: B007 - намеренный бесконечный цикл для нагрузочного теста
        phase += 1
        # плавное наращивание конкуренции и числа операций
        workers = min(5 * phase, 100)
        tasks_count = 10 * phase

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(worker, phase) for _ in range(tasks_count)]
            for f in as_completed(futures):
                try:
                    f.result()
                except AssertionError as exc:
                    pytest.fail(f"Нагрузочный тест упал на фазе {phase}: {exc}")
                except Exception as exc:  # noqa: BLE001
                    pytest.fail(f"Нагрузочный тест поймал исключение на фазе {phase}: {exc!r}")

        # Ограничиваем рост массивов в памяти (держим последние N элементов)
        if len(tasks) > 5000:
            del tasks[:-3000]
        if len(executors) > 500:
            del executors[:-300]

        # Короткая пауза, чтобы графики были читаемее, но нагрузка всё равно высокая
        time.sleep(0.2)


