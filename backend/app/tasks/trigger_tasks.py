"""Celery задачи для обработки триггеров"""
from celery import shared_task
from app.core.database import SessionLocal
from app.services.trigger_processor import process_trigger_event
from app.models.bot import Bot
from app.models.trigger import Trigger, TriggerEvent
from app.models.telegram_user import TelegramUser
from datetime import datetime, timedelta
import logging
import asyncio

logger = logging.getLogger(__name__)


@shared_task
def check_inactive_users_task():
    """Периодическая задача для проверки неактивных пользователей"""
    db = SessionLocal()
    try:
        # Получаем всех активных ботов
        bots = db.query(Bot).filter(Bot.is_active == True).all()
        logger.info(f"Checking inactive users for {len(bots)} active bots")
        
        for bot in bots:
            try:
                # Получаем все активные триггеры типа user_inactive для этого бота
                triggers = db.query(Trigger).filter(
                    Trigger.bot_id == bot.id,
                    Trigger.event_type == TriggerEvent.USER_INACTIVE.value,
                    Trigger.is_active == True
                ).all()
                
                if not triggers:
                    logger.debug(f"No active user_inactive triggers for bot {bot.id}")
                    continue
                
                # Для каждого триггера проверяем пользователей с соответствующим периодом неактивности
                for trigger in triggers:
                    # Получаем количество дней из условий триггера (по умолчанию 7)
                    days_inactive = 7
                    if trigger.conditions and 'days_inactive' in trigger.conditions:
                        days_inactive = int(trigger.conditions['days_inactive'])
                    
                    logger.info(f"Checking trigger {trigger.id} ({trigger.name}) for bot {bot.id} with {days_inactive} days inactive")
                    
                    # Находим пользователей, неактивных указанное количество дней
                    cutoff_date = datetime.utcnow() - timedelta(days=days_inactive)
                    inactive_users = db.query(TelegramUser).filter(
                        TelegramUser.bot_id == bot.id,
                        TelegramUser.status == "active",
                        TelegramUser.last_activity < cutoff_date
                    ).all()
                    
                    logger.info(f"Found {len(inactive_users)} inactive users for trigger {trigger.id}")
                    
                    # Для каждого неактивного пользователя запускаем обработку триггера
                    for user in inactive_users:
                        try:
                            asyncio.run(process_trigger_event(
                                db=db,
                                event_type=TriggerEvent.USER_INACTIVE.value,
                                bot_id=bot.id,
                                telegram_user_id=user.telegram_user_id,
                                data={"days_inactive": days_inactive}
                            ))
                        except Exception as e:
                            logger.error(f"Error processing trigger {trigger.id} for user {user.telegram_user_id}: {e}")
                            
            except Exception as e:
                logger.error(f"Error checking inactive users for bot {bot.id}: {e}", exc_info=True)
    finally:
        db.close()

