"""Celery задачи для обработки триггеров"""
from celery import shared_task
from app.core.database import SessionLocal
from app.services.trigger_processor import check_inactive_users
from app.models.bot import Bot
import logging

logger = logging.getLogger(__name__)


@shared_task
def check_inactive_users_task():
    """Периодическая задача для проверки неактивных пользователей"""
    db = SessionLocal()
    try:
        # Получаем всех активных ботов
        bots = db.query(Bot).filter(Bot.is_active == True).all()
        
        for bot in bots:
            try:
                # Проверяем неактивных пользователей (7 дней по умолчанию)
                # В реальной реализации можно сделать настраиваемым
                check_inactive_users(db, bot.id, days=7)
            except Exception as e:
                logger.error(f"Error checking inactive users for bot {bot.id}: {e}")
    finally:
        db.close()

