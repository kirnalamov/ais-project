## Тестирование

Тесты backend находятся в каталоге `backend/tests/` и бьют по реальному API через HTTP  
(по умолчанию `BACKEND_BASE_URL = http://localhost:8000`).

### Структура тестов

- `tests/utils.py` — общие хелперы:
  - `_url`, `_login`, `_login_admin`, `_auth_headers`, `DEFAULT_PASSWORD`.
- `tests/test_basic_api.py` — базовые проверки:
  - доступность `/`, `/openapi.json`;
  - логин админа.
- `tests/test_chat_and_status.py`:
  - сценарий чатов задач (создание задачи, сообщения от админа/исполнителя);
  - смена статусов задач с учётом зависимостей.
- `tests/test_projects_and_members.py`:
  - добавление участников в проект от имени менеджера и админа;
  - проверка запрета для обычного исполнителя.
- `tests/test_mass_flow.py`:
  - массовый сценарий: 100 пользователей, несколько проектов, ~1000 задач, зависимости, сообщения, смена статусов и правок.
- `tests/test_load.py`:
  - нагрузочный тест с маркером `@pytest.mark.load` (см. ниже).

### Запуск

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# все интеграционные тесты
pytest

# конкретный файл
pytest tests/test_chat_and_status.py

# только нагрузочные
pytest -m load
```

### Нагрузочный сценарий

Тест `test_increasing_load_until_first_failure` (`tests/test_load.py`):

- создаёт менеджеров/исполнителей, несколько проектов и набор задач;
- в бесконечном цикле увеличивает конкуренцию и количество операций;
- внутри воркеров:
  - логины пользователей;
  - создание пользователей/проектов/задач;
  - отправка сообщений в чат задач;
  - вызовы тяжёлого анализа графа проекта;
- падает при первой серьёзной ошибке (HTTP 5xx или исключение).

Рекомендуется запускать только вручную на dev/test окружении и наблюдать метрики через Grafana/Prometheus.



