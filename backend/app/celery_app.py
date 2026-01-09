from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "gategram",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Автоматически обнаруживать задачи в модулях tasks
    include=['app.tasks.broadcast_tasks', 'app.tasks.trigger_tasks'],
    beat_schedule={
        'check-inactive-users': {
            'task': 'app.tasks.trigger_tasks.check_inactive_users_task',
            'schedule': 3600.0,  # Каждый час
        },
        'cleanup-old-media-files': {
            'task': 'cleanup_old_media_files',
            'schedule': crontab(hour=2, minute=0),  # Каждый день в 2:00 UTC
        },
    }
)

# Явно импортируем задачи для регистрации
import app.tasks.broadcast_tasks  # noqa: F401
import app.tasks.trigger_tasks  # noqa: F401

