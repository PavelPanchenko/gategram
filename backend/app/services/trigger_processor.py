"""Сервис для обработки автоматических триггеров"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import logging
from app.models.trigger import Trigger, TriggerEvent, TriggerAction
from app.models.telegram_user import TelegramUser
from app.models.user_tag import UserTag
from app.models.message_template import MessageTemplate
from app.services.bot_manager import bot_manager
from app.utils.template_processor import process_template

logger = logging.getLogger(__name__)


async def process_trigger_event(
    db: Session,
    event_type: str,
    bot_id: int,
    telegram_user_id: Optional[int] = None,
    data: Optional[dict] = None
):
    """Обработать событие и выполнить соответствующие триггеры"""
    if data is None:
        data = {}
    
    logger.info(f"Processing trigger event: type={event_type}, bot_id={bot_id}, user_id={telegram_user_id}, data={data}")
    
    # Получаем активные триггеры для этого события
    triggers = db.query(Trigger).filter(
        Trigger.bot_id == bot_id,
        Trigger.event_type == event_type,
        Trigger.is_active == True
    ).all()
    
    logger.info(f"Found {len(triggers)} active triggers for event {event_type} in bot {bot_id}")
    
    if not triggers:
        logger.debug(f"No active triggers found for event {event_type} in bot {bot_id}")
        return
    
    for trigger in triggers:
        try:
            logger.info(f"Processing trigger {trigger.id} ({trigger.name}) for event {event_type}")
            
            # Проверяем условия триггера
            if not _check_conditions(trigger, telegram_user_id, db, data):
                logger.debug(f"Trigger {trigger.id} conditions not met, skipping")
                continue
            
            logger.info(f"Trigger {trigger.id} conditions met, executing action {trigger.action_type}")
            
            # Выполняем действие
            await _execute_action(trigger, bot_id, telegram_user_id, db, data)
            
            logger.info(f"Trigger {trigger.id} executed successfully")
            
        except Exception as e:
            logger.error(f"Error processing trigger {trigger.id}: {e}", exc_info=True)


def _check_conditions(trigger: Trigger, telegram_user_id: Optional[int], db: Session, data: dict) -> bool:
    """Проверить условия триггера"""
    conditions = trigger.conditions or {}
    
    # Если нет условий, триггер срабатывает всегда
    if not conditions:
        return True
    
    # Проверка на неактивность пользователя
    if "days_inactive" in conditions:
        if not telegram_user_id:
            return False
        
        user = db.query(TelegramUser).filter(
            TelegramUser.telegram_user_id == telegram_user_id,
            TelegramUser.bot_id == trigger.bot_id
        ).first()
        
        if not user:
            return False
        
        days_inactive = (datetime.utcnow() - user.last_activity).days
        if days_inactive < conditions["days_inactive"]:
            return False
    
    # Проверка источника
    if "source" in conditions:
        if not telegram_user_id:
            return False
        
        user = db.query(TelegramUser).filter(
            TelegramUser.telegram_user_id == telegram_user_id,
            TelegramUser.bot_id == trigger.bot_id
        ).first()
        
        if not user or user.source != conditions["source"]:
            return False
    
    # Проверка тегов
    if "tags" in conditions:
        if not telegram_user_id:
            return False
        
        user = db.query(TelegramUser).filter(
            TelegramUser.telegram_user_id == telegram_user_id,
            TelegramUser.bot_id == trigger.bot_id
        ).first()
        
        if not user:
            return False
        
        user_tag_names = {tag.name for tag in user.tags}
        required_tags = set(conditions["tags"])
        
        if not required_tags.issubset(user_tag_names):
            return False
    
    return True


async def _execute_action(
    trigger: Trigger,
    bot_id: int,
    telegram_user_id: Optional[int],
    db: Session,
    data: dict
):
    """Выполнить действие триггера (поддерживает множественные действия)"""
    # Проверяем новое поле actions (правильный формат)
    if trigger.actions and isinstance(trigger.actions, list) and len(trigger.actions) > 0:
        # Новый формат: массив действий в поле actions
        logger.info(f"Executing {len(trigger.actions)} actions for trigger {trigger.id}")
        for idx, action in enumerate(trigger.actions):
            action_type = action.get("type")
            action_params = action.get("data", {})
            logger.info(f"Executing action {idx + 1}/{len(trigger.actions)}: type={action_type}")
            
            if action_type == TriggerAction.SEND_MESSAGE.value:
                await _send_message_action(trigger, bot_id, telegram_user_id, db, action_params, data)
            elif action_type == TriggerAction.ADD_TAG.value:
                await _add_tag_action(trigger, bot_id, telegram_user_id, db, action_params)
            elif action_type == TriggerAction.REMOVE_TAG.value:
                await _remove_tag_action(trigger, bot_id, telegram_user_id, db, action_params)
    else:
        # Старый формат: одно действие в action_type/action_data (для обратной совместимости)
        logger.info(f"Using legacy format for trigger {trigger.id}: action_type={trigger.action_type}")
        action_data = trigger.action_data or {}
        
        if trigger.action_type == TriggerAction.SEND_MESSAGE.value:
            await _send_message_action(trigger, bot_id, telegram_user_id, db, action_data, data)
        
        elif trigger.action_type == TriggerAction.ADD_TAG.value:
            await _add_tag_action(trigger, bot_id, telegram_user_id, db, action_data)
        
        elif trigger.action_type == TriggerAction.REMOVE_TAG.value:
            await _remove_tag_action(trigger, bot_id, telegram_user_id, db, action_data)


async def _send_message_action(
    trigger: Trigger,
    bot_id: int,
    telegram_user_id: Optional[int],
    db: Session,
    action_data: dict,
    event_data: dict
):
    """Отправить сообщение пользователю"""
    if not telegram_user_id:
        return
    
    bot_instance = bot_manager.get_bot(bot_id)
    if not bot_instance:
        logger.warning(f"Bot {bot_id} is not running, cannot send message")
        return
    
    # Получаем текст сообщения
    message_text = action_data.get("message", "")
    
    # Если указан template_id, используем шаблон
    if "template_id" in action_data:
        template = db.query(MessageTemplate).filter(
            MessageTemplate.id == action_data["template_id"],
            MessageTemplate.bot_id == bot_id
        ).first()
        
        if template:
            user = db.query(TelegramUser).filter(
                TelegramUser.telegram_user_id == telegram_user_id,
                TelegramUser.bot_id == bot_id
            ).first()
            
            if user:
                message_text = process_template(template.content, user, event_data)
    
    try:
        await bot_instance.send_message(chat_id=telegram_user_id, text=message_text)
        logger.info(f"Sent message to user {telegram_user_id} via trigger {trigger.id}")
    except Exception as e:
        logger.error(f"Failed to send message to user {telegram_user_id}: {e}")


async def _add_tag_action(
    trigger: Trigger,
    bot_id: int,
    telegram_user_id: Optional[int],
    db: Session,
    action_data: dict
):
    """Добавить тег пользователю"""
    if not telegram_user_id:
        return
    
    tag_id = action_data.get("tag_id")
    if not tag_id:
        return
    
    user = db.query(TelegramUser).filter(
        TelegramUser.telegram_user_id == telegram_user_id,
        TelegramUser.bot_id == bot_id
    ).first()
    
    if not user:
        return
    
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.bot_id == bot_id
    ).first()
    
    if tag and tag not in user.tags:
        user.tags.append(tag)
        db.commit()
        logger.info(f"Added tag {tag.name} to user {telegram_user_id}")


async def _remove_tag_action(
    trigger: Trigger,
    bot_id: int,
    telegram_user_id: Optional[int],
    db: Session,
    action_data: dict
):
    """Удалить тег у пользователя"""
    if not telegram_user_id:
        return
    
    tag_id = action_data.get("tag_id")
    if not tag_id:
        return
    
    user = db.query(TelegramUser).filter(
        TelegramUser.telegram_user_id == telegram_user_id,
        TelegramUser.bot_id == bot_id
    ).first()
    
    if not user:
        return
    
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.bot_id == bot_id
    ).first()
    
    if tag and tag in user.tags:
        user.tags.remove(tag)
        db.commit()
        logger.info(f"Removed tag {tag.name} from user {telegram_user_id}")


# Webhook functionality removed


async def check_inactive_users(db: Session, bot_id: int, days: int = 7):
    """Проверить неактивных пользователей и запустить триггеры"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    inactive_users = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.status == "active",
        TelegramUser.last_activity < cutoff_date
    ).all()
    
    for user in inactive_users:
        await process_trigger_event(
            db=db,
            event_type=TriggerEvent.USER_INACTIVE.value,
            bot_id=bot_id,
            telegram_user_id=user.telegram_user_id,
            data={"days_inactive": days}
        )

