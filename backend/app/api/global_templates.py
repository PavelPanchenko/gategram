from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.message_template import MessageTemplate
from app.schemas.message_template import MessageTemplateResponse
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/templates", tags=["templates-global"])


@router.get("", response_model=List[MessageTemplateResponse])
async def get_all_templates(
    bot_id: Optional[int] = Query(None, description="Фильтр по ID бота"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все шаблоны (с опциональным фильтром по боту)"""
    # Получаем все боты пользователя
    user_bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    bot_ids = [bot.id for bot in user_bots]
    
    if not bot_ids:
        return []
    
    # Запрос шаблонов
    query = db.query(MessageTemplate).filter(MessageTemplate.bot_id.in_(bot_ids))
    
    # Применяем фильтр по bot_id, если указан
    if bot_id is not None:
        if bot_id not in bot_ids:
            return []  # Бот не принадлежит пользователю
        query = query.filter(MessageTemplate.bot_id == bot_id)
    
    templates = query.order_by(MessageTemplate.created_at.desc()).all()
    
    # Добавляем информацию о боте к каждому шаблону
    result = []
    for template in templates:
        # Находим бота для этого шаблона
        bot = next((b for b in user_bots if b.id == template.bot_id), None)
        bot_name = None
        if bot:
            bot_name = bot.name or bot.username or f"Bot #{bot.id}"
        
        result.append(MessageTemplateResponse(
            id=template.id,
            bot_id=template.bot_id,
            name=template.name,
            content=template.content,
            variables=template.variables or {},
            is_active=template.is_active,
            created_at=template.created_at,
            updated_at=template.updated_at,
            bot_name=bot_name
        ))
    
    return result

