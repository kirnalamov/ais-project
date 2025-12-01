## Backend (FastAPI)

Этот каталог содержит backend‑часть проекта (AIS корпоративный планировщик задач) на **FastAPI + SQLAlchemy**.

- **Основной модуль приложения**: `app/main.py`
- **Работа с БД**: `app/db.py`, `app/models.py`
- **Схемы (Pydantic)**: `app/schemas.py`
- **Роутеры (эндпоинты API)**: `app/routers/*.py`

Ниже — краткая документация по **Swagger/OpenAPI**, **Postman**, **структуре таблиц БД** и **тестам**.

---

## Swagger / OpenAPI документация

Backend автоматически поднимает интерактивную документацию:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **JSON‑схема OpenAPI**: `http://localhost:8000/openapi.json`

Swagger генерируется напрямую из **FastAPI**, моделей **Pydantic** и роутеров в `app/routers`.  
При старте приложения объект `FastAPI` создаётся в `app/main.py`:

```12:18:backend/app/main.py
app = FastAPI(title="Корпоративный планировщик задач")
```

Через Swagger UI можно:

- Просмотреть все эндпоинты (auth, users, projects, tasks, analysis и др.)
- Смотреть схемы запросов/ответов
- Тестировать запросы прямо из браузера (нужно предварительно получить токен и прописать `Authorize` с `Bearer <token>`)

---

## Postman для тестирования запросов

В backend добавлена готовая **Postman‑коллекция**:

- Файл: `backend/postman_collection.json`

В коллекции есть примеры:

- **Авторизация**: `POST /auth/login` (admin / manager / executor)
- **Текущий пользователь**: `GET /auth/me`
- **Проекты**: список и создание (`GET /projects`, `POST /projects`)
- **Задачи**: список и создание (`GET /tasks`, `POST /tasks`)

### Как использовать коллекцию в Postman

1. Откройте Postman → **Import** → выберите файл `backend/postman_collection.json`.
2. В разделе **Environments** создайте окружение с переменной:
   - `baseUrl` = `http://localhost:8000` (или другой адрес backend).
3. Выберите это окружение в Postman.
4. Сначала выполните запрос **Auth / Login (admin)**, скопируйте `access_token`.
5. В других запросах укажите заголовок:
   - `Authorization: Bearer <access_token>`

> При необходимости коллекцию можно пере‑импортировать из актуальной схемы OpenAPI (`/openapi.json`) через встроенный импорт в Postman.

---

## Таблицы БД (SQLAlchemy модели)

Таблицы описаны через **SQLAlchemy ORM** в файле `app/models.py`.  
Создание схемы БД происходит при старте приложения в функции `init_db`:

```23:28:backend/app/db.py
def init_db() -> None:
    # Import models before create_all to ensure metadata is populated
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
```

То есть:

- При первом запуске backend читает `DATABASE_URL` (по умолчанию SQLite: `sqlite:///./app.db`).
- Вызывает `Base.metadata.create_all(bind=engine)`, создавая таблицы по описанию моделей.
- Для PostgreSQL `DATABASE_URL` задаётся через `.env` (см. корневой `README.md`).

### Основные таблицы

Кратко по ключевым моделям:

- **`users`** (`User`)
  - Пользователи системы.
  - Поля: `email`, `password_hash`, `full_name`, `nickname`, `phone`, `telegram`, `role` (`admin` / `manager` / `executor`).
- **`projects`** (`Project`)
  - Проекты (верхний уровень управления).
  - Поля: `name`, `description`, `deadline`, `customer`, `manager_id`, `budget_plan`, `created_at`, `updated_at`.
- **`tasks`** (`Task`)
  - Задачи внутри проекта.
  - Поля: `name`, `description`, `project_id`, `assignee_id`, `status`, `priority`, `duration_plan`, `deadline`, `created_at`, `updated_at`.
- **`task_dependencies`** (`TaskDependency`)
  - Зависимости между задачами (`blocks`).
  - Поля: `task_id`, `depends_on_task_id`, `dependency_type`, уникальное ограничение на пару (`task_id`, `depends_on_task_id`).
- **`activity_log`** (`ActivityLog`)
  - Лог изменений по задачам (кто и что менял).
  - Поля: `task_id`, `user_id`, `action`, `old_value`, `new_value`, `created_at`.
- **`project_members`** (`ProjectMember`)
  - Связь пользователей и проектов (участники проектов).
  - Поля: `project_id`, `user_id`, уникальное ограничение на пару.
- **`task_messages`** (`TaskMessage`)
  - Сообщения (чат) по задачам.
  - Поля: `task_id`, `author_id`, `content`, `created_at`.

Если нужно увидеть точные поля и типы — смотрите `app/models.py`:

```44:75:backend/app/models.py
class User(Base):
    __tablename__ = "users"
    ...

class Project(Base):
    __tablename__ = "projects"
    ...

class Task(Base):
    __tablename__ = "tasks"
    ...
```

---

## Тестирование backend (pytest)

Для backend настроены интеграционные и нагрузочные тесты на **pytest**, которые бьют по **реальному Docker‑backend** по HTTP.

- Каталог с тестами: `backend/tests/`
- Базовый URL API берётся из `BACKEND_BASE_URL` (по умолчанию `http://localhost:8000`).
- Для маркировки используются pytest‑маркеры:
  - обычные интеграционные тесты (без маркера);
  - `@pytest.mark.load` — нагрузочные сценарии (запускать вручную).

### Запуск интеграционных тестов

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# при запущенном Docker‑backend (docker compose up)
pytest
```

В тестах покрыты сценарии:

- авторизация (`/auth/login`), базовая доступность API и OpenAPI;
- создание пользователей, проектов, задач, зависимостей;
- добавление участников в проекты от имени **админа** и **менеджера** (права ролей);
- сообщения в чатах задач (`/tasks/{id}/messages`);
- смена статусов задач с учётом зависимостей (невозможно начать задачу, пока предшественники не `done`);
- массовый сценарий (`test_mass_flow_many_users_projects_tasks`): 100 пользователей, несколько проектов, ~1000 задач, связи, сообщения и смена статусов.

### Нагрузочные тесты

Отдельные тесты с маркером `load` имитируют реальную работу системы под нагрузкой.

```bash
# запуск только нагрузочных тестов
pytest -m load
```

Ключевой тест `test_increasing_load_until_first_failure`:

- создаёт менеджеров, исполнителей, проекты и задачи;
- в бесконечном цикле увеличивает конкуренцию (количество потоков) и частоту операций;
- в каждом шаге смешивает разные типы запросов:
  - логины пользователей;
  - создание новых пользователей / проектов / задач;
  - добавление зависимостей между задачами;
  - отправку сообщений в чаты задач;
  - тяжёлый анализ графа проекта `/analysis/projects/{id}/graph`;
- останавливается и **падает** при первой серьёзной ошибке (HTTP 5xx или исключение).

Тест предназначен для ручного прогона (можно остановить по `Ctrl+C`) и хорошо виден в метриках Prometheus/Grafana.  
Запускать его рекомендуется только на dev‑/test‑окружении, а не в проде.
