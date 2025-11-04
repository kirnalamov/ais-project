from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from .. import models


DEMO_PROJECT_NAME = "Демонстрационный проект"


def ensure_demo_data(db: Session) -> models.Project:
    """Ensure that the demo project, tasks, and memberships are present."""

    project, created = _ensure_demo_project(db)
    if created:
        _ensure_demo_tasks(db, project)
    _ensure_memberships(db, project)
    return project


def ensure_user_in_demo_project(db: Session, user: models.User) -> None:
    """Add a user to the demo project if they are not part of it yet."""

    project, created = _ensure_demo_project(db)
    if created:
        _ensure_demo_tasks(db, project)

    exists = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project.id, models.ProjectMember.user_id == user.id)
        .first()
    )
    if exists:
        return

    db.add(models.ProjectMember(project_id=project.id, user_id=user.id))
    db.commit()


def _ensure_demo_project(db: Session) -> tuple[models.Project, bool]:
    project = db.query(models.Project).filter(models.Project.name == DEMO_PROJECT_NAME).first()
    if project:
        return project, False

    manager = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.manager)
        .order_by(models.User.id)
        .first()
    )

    project = models.Project(
        name=DEMO_PROJECT_NAME,
        description=(
            "Пошаговый сценарий реализации крупного внедрения: от инициации и "
            "аналитики до запуска и сопровождения. Данные проекта помогают быстро "
            "оценить основные возможности системы."
        ),
        deadline=date.today() + timedelta(days=120),
        customer="DemoCorp",
        manager_id=manager.id if manager else None,
        budget_plan=750_000.0,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project, True


def _ensure_demo_tasks(db: Session, project: models.Project) -> None:
    has_tasks = db.query(models.Task).filter(models.Task.project_id == project.id).first() is not None
    if has_tasks:
        return

    today = date.today()

    manager = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.manager)
        .order_by(models.User.id)
        .first()
    )
    executor = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.executor)
        .order_by(models.User.id)
        .first()
    )

    tasks_data = [
        {
            "key": "init",
            "name": "Инициация проекта",
            "description": "Сбор требований, определение целей и ключевых показателей успеха.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.done,
            "priority": models.TaskPriority.high,
            "duration_plan": 5,
            "deadline": today + timedelta(days=7),
        },
        {
            "key": "charter",
            "name": "Утверждение устава",
            "description": "Формирование дорожной карты, бюджетов и ключевых ролей.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.done,
            "priority": models.TaskPriority.high,
            "duration_plan": 3,
            "deadline": today + timedelta(days=10),
        },
        {
            "key": "discovery",
            "name": "Дискавери-сессии",
            "description": "Интервью с бизнес-заказчиками, формирование пользовательских историй.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.done,
            "priority": models.TaskPriority.high,
            "duration_plan": 8,
            "deadline": today + timedelta(days=14),
        },
        {
            "key": "stakeholders",
            "name": "Картирование стейкхолдеров",
            "description": "Определение ключевых участников и каналов коммуникации.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.in_progress,
            "priority": models.TaskPriority.medium,
            "duration_plan": 4,
            "deadline": today + timedelta(days=18),
        },
        {
            "key": "architecture",
            "name": "Архитектурное проектирование",
            "description": "Проработка целевой архитектуры, интеграционных точек и планов масштабирования.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.in_progress,
            "priority": models.TaskPriority.high,
            "duration_plan": 10,
            "deadline": today + timedelta(days=24),
        },
        {
            "key": "ux_research",
            "name": "UX-исследование",
            "description": "Наблюдения, интервью с пользователями, сбор болей и ожиданий.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.in_progress,
            "priority": models.TaskPriority.medium,
            "duration_plan": 6,
            "deadline": today + timedelta(days=28),
        },
        {
            "key": "ux_wireframes",
            "name": "Прототипирование интерфейсов",
            "description": "Создание интерактивных прототипов, согласование дизайн-системы.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 7,
            "deadline": today + timedelta(days=35),
        },
        {
            "key": "backend_core",
            "name": "Разработка ядра платформы",
            "description": "Базовые доменные сервисы, авторизация, управление ролями.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 14,
            "deadline": today + timedelta(days=42),
        },
        {
            "key": "backend_api",
            "name": "API и интеграционные шлюзы",
            "description": "Проработка REST/GraphQL контрактов, настройка шины событий.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 12,
            "deadline": today + timedelta(days=52),
        },
        {
            "key": "integration_crm",
            "name": "Интеграция с CRM",
            "description": "Синхронизация клиентов, сделок и уведомлений.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 9,
            "deadline": today + timedelta(days=60),
        },
        {
            "key": "integration_erp",
            "name": "Интеграция с ERP",
            "description": "Обмен финансовыми данными и планами производства.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 8,
            "deadline": today + timedelta(days=62),
        },
        {
            "key": "data_migration",
            "name": "Миграция исторических данных",
            "description": "Подготовка ETL-пайплайнов, очистка и загрузка данных.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 11,
            "deadline": today + timedelta(days=70),
        },
        {
            "key": "security_review",
            "name": "Security-аудит",
            "description": "Пентест, проверка соответствия политикам и стандартам.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 6,
            "deadline": today + timedelta(days=58),
        },
        {
            "key": "qa_plan",
            "name": "План качества",
            "description": "Матрица тестирования, сценарии UAT, план регрессий.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 5,
            "deadline": today + timedelta(days=65),
        },
        {
            "key": "qa_manual",
            "name": "Ручное тестирование",
            "description": "Проверка ключевых сценариев, фиксация дефектов.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 9,
            "deadline": today + timedelta(days=75),
        },
        {
            "key": "qa_automation",
            "name": "Автоматизация тестов",
            "description": "Покрытие критичного функционала автотестами.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 12,
            "deadline": today + timedelta(days=82),
        },
        {
            "key": "training_materials",
            "name": "Материалы для обучения",
            "description": "Создание гайдов, видео и чек-листов для пользователей.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 6,
            "deadline": today + timedelta(days=85),
        },
        {
            "key": "pilot",
            "name": "Пилотный запуск",
            "description": "Запуск на ограниченной аудитории, мониторинг метрик.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 8,
            "deadline": today + timedelta(days=95),
        },
        {
            "key": "feedback_iteration",
            "name": "Итерация по обратной связи",
            "description": "Приоритезация фидбэка, багфиксы и мини-улучшения.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 7,
            "deadline": today + timedelta(days=105),
        },
        {
            "key": "launch",
            "name": "Финальный релиз",
            "description": "Включение всех интеграций, уведомление пользователей, запуск поддержки.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.high,
            "duration_plan": 6,
            "deadline": today + timedelta(days=112),
        },
        {
            "key": "hypercare",
            "name": "Гиперкэр-поддержка",
            "description": "Усиленная поддержка, отслеживание SLA и устранение критических инцидентов.",
            "assignee_id": executor.id if executor else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.medium,
            "duration_plan": 10,
            "deadline": today + timedelta(days=125),
        },
        {
            "key": "retrospective",
            "name": "Ретроспектива",
            "description": "Обсуждение достижений, улучшений и планов следующей волны внедрения.",
            "assignee_id": manager.id if manager else None,
            "status": models.TaskStatus.backlog,
            "priority": models.TaskPriority.low,
            "duration_plan": 3,
            "deadline": today + timedelta(days=135),
        },
    ]

    task_entities = [
        models.Task(
            name=item["name"],
            description=item["description"],
            project_id=project.id,
            assignee_id=item["assignee_id"],
            status=item["status"],
            priority=item["priority"],
            duration_plan=item["duration_plan"],
            deadline=item["deadline"],
        )
        for item in tasks_data
    ]

    db.add_all(task_entities)
    db.commit()

    # Refresh instances to access IDs
    for task in task_entities:
        db.refresh(task)

    tasks_map = {data["key"]: entity for data, entity in zip(tasks_data, task_entities)}

    dependencies = [
        ("charter", "init"),
        ("discovery", "charter"),
        ("stakeholders", "discovery"),
        ("architecture", "discovery"),
        ("ux_research", "discovery"),
        ("ux_wireframes", "ux_research"),
        ("backend_core", "architecture"),
        ("backend_api", "backend_core"),
        ("integration_crm", "backend_api"),
        ("integration_erp", "backend_api"),
        ("data_migration", "integration_crm"),
        ("data_migration", "integration_erp"),
        ("security_review", "backend_api"),
        ("qa_plan", "backend_api"),
        ("qa_manual", "qa_plan"),
        ("qa_automation", "qa_plan"),
        ("training_materials", "qa_manual"),
        ("pilot", "integration_crm"),
        ("pilot", "integration_erp"),
        ("pilot", "qa_manual"),
        ("pilot", "qa_automation"),
        ("pilot", "training_materials"),
        ("feedback_iteration", "pilot"),
        ("feedback_iteration", "security_review"),
        ("launch", "feedback_iteration"),
        ("launch", "security_review"),
        ("hypercare", "launch"),
        ("retrospective", "hypercare"),
    ]

    dependency_entities = []
    for task_key, depends_on_key in dependencies:
        task = tasks_map.get(task_key)
        depends_on = tasks_map.get(depends_on_key)
        if not task or not depends_on:
            continue
        dependency_entities.append(
            models.TaskDependency(
                task_id=task.id,
                depends_on_task_id=depends_on.id,
                dependency_type=models.DependencyType.blocks,
            )
        )

    if dependency_entities:
        db.add_all(dependency_entities)
        db.commit()


def _ensure_memberships(db: Session, project: models.Project) -> None:
    existing_member_ids = {
        member.user_id
        for member in db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project.id)
    }
    users = db.query(models.User).all()

    new_members = [
        models.ProjectMember(project_id=project.id, user_id=user.id)
        for user in users
        if user.id not in existing_member_ids
    ]

    if not new_members:
        return

    db.add_all(new_members)
    db.commit()


