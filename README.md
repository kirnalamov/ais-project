# Корпоративный планировщик задач

Веб‑приложение для управления проектами, декомпозиции на задачи, оптимизации распределения ресурсов и визуализации зависимостей (DAG) с расчётом критического пути (CPM).

## Технологический стек
- Backend: FastAPI (Python 3.11), SQLAlchemy, PostgreSQL
- Frontend: React + TypeScript, Vite, Cytoscape.js
- Infra: Docker, docker-compose

## Быстрый старт (Docker)
1. Создайте файл окружения:
   - Скопируйте `backend/.env.example` в `backend/.env`
2. Запустите контейнеры:
   ```bash
   docker compose up --build
   ```
3. Откройте приложения:
   - Backend OpenAPI: `http://localhost:8000/docs`
   - Frontend: `http://localhost:5173`

## Локальный запуск без Docker (SQLite)
Backend и frontend можно запустить локально без Docker. База по умолчанию — SQLite (файл `backend/app.db`).

### Backend (FastAPI)
PowerShell (Windows):
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="sqlite:///./app.db"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Bash (macOS/Linux):
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="sqlite:///./app.db"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Откройте Swagger: `http://localhost:8000/docs`.

### Frontend (Vite + React)
PowerShell (Windows):
```powershell
cd frontend
npm install
$env:VITE_API_BASE="http://localhost:8000"
npm run dev -- --host
```

Bash (macOS/Linux):
```bash
cd frontend
npm install
export VITE_API_BASE="http://localhost:8000"
npm run dev -- --host
```

Откройте приложение: `http://localhost:5173`.

## Запуск в Docker (PostgreSQL)
Убедитесь, что Docker Desktop запущен.

1. Создайте файл окружения для backend:
   ```
   DATABASE_URL=postgresql+psycopg2://app:app@db:5432/appdb
   ```
   Сохраните как `backend/.env`.
2. Соберите и запустите:
   ```bash
   docker compose up --build
   ```
3. Доступ:
   - Backend OpenAPI: `http://localhost:8000/docs`
   - Frontend: `http://localhost:5173`
   
Примечание: предупреждение Docker о ключе `version` в `docker-compose.yml` можно игнорировать или удалить поле `version` из файла.

## Пример начального наполнения (seed)
После запуска создайте проект и несколько задач:

```bash
# Проект
curl -X POST http://localhost:8000/projects/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo проект","description":"Пример","budget_plan":10000}'

# Задачи (укажите project_id из ответа, например 1)
curl -X POST http://localhost:8000/tasks/ -H "Content-Type: application/json" \
  -d '{"name":"Аналитика","project_id":1,"duration_plan":5}'
curl -X POST http://localhost:8000/tasks/ -H "Content-Type: application/json" \
  -d '{"name":"Дизайн","project_id":1,"duration_plan":3}'
curl -X POST http://localhost:8000/tasks/ -H "Content-Type: application/json" \
  -d '{"name":"Разработка","project_id":1,"duration_plan":10}'
curl -X POST http://localhost:8000/tasks/ -H "Content-Type: application/json" \
  -d '{"name":"Тестирование","project_id":1,"duration_plan":4}'

# Зависимости: Аналитика -> Дизайн -> Разработка -> Тестирование
curl -X POST http://localhost:8000/tasks/dependencies -H "Content-Type: application/json" \
  -d '{"task_id":2,"depends_on_task_id":1}'
curl -X POST http://localhost:8000/tasks/dependencies -H "Content-Type: application/json" \
  -d '{"task_id":3,"depends_on_task_id":2}'
curl -X POST http://localhost:8000/tasks/dependencies -H "Content-Type: application/json" \
  -d '{"task_id":4,"depends_on_task_id":3}'

# Анализ графа
curl http://localhost:8000/analysis/projects/1/graph | jq
```

## Структура репозитория
```
backend/
  app/
    main.py
    db.py
    models.py
    schemas.py
    routers/
      projects.py
      tasks.py
      analysis.py
    services/
      scheduling.py
  requirements.txt
  .env.example
frontend/
  package.json
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    components/GraphView.tsx
docker-compose.yml
```

## Примечания
- Для простоты миграции Alembic не включены на первом этапе; БД создаётся через `SQLAlchemy.create_all()`.
- Авторизация планируется позже. Роли присутствуют в модели.

# ais-project
