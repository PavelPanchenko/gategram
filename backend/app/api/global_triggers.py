from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.trigger import Trigger
from app.schemas.trigger import TriggerResponse
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/triggers", tags=["triggers-global"])


@router.get("", response_model=List[TriggerResponse])
async def get_all_triggers(
    bot_id: Optional[int] = Query(None, description="Фильтр по ID бота"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все триггеры (с опциональным фильтром по боту)"""
    # Получаем все боты пользователя
    user_bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    bot_ids = [bot.id for bot in user_bots]
    
    if not bot_ids:
        return []
    
    # Запрос триггеров
    query = db.query(Trigger).filter(Trigger.bot_id.in_(bot_ids))
    
    # Применяем фильтр по bot_id, если указан
    if bot_id is not None:
        if bot_id not in bot_ids:
            return []  # Бот не принадлежит пользователю
        query = query.filter(Trigger.bot_id == bot_id)
    
    triggers = query.order_by(Trigger.created_at.desc()).all()
    
    # Добавляем информацию о боте к каждому триггеру
    result = []
    for trigger in triggers:
        # Находим бота для этого триггера
        bot = next((b for b in user_bots if b.id == trigger.bot_id), None)
        bot_name = None
        if bot:
            bot_name = bot.name or bot.username or f"Bot #{bot.id}"
        
        result.append(TriggerResponse(
            id=trigger.id,
            bot_id=trigger.bot_id,
            name=trigger.name,
            event_type=trigger.event_type,
            action_type=trigger.action_type,
            action_data=trigger.action_data or {},
            conditions=trigger.conditions or {},
            is_active=trigger.is_active,
            created_at=trigger.created_at,
            updated_at=trigger.updated_at,
            bot_name=bot_name
        ))
    
    return result

