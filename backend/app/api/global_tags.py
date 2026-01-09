from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.user_tag import UserTag
from app.schemas.user_tag import UserTagResponse
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tags", tags=["tags-global"])


@router.get("", response_model=List[UserTagResponse])
async def get_all_tags(
    bot_id: Optional[int] = Query(None, description="Фильтр по ID бота"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все теги (с опциональным фильтром по боту)"""
    # Получаем все боты пользователя
    user_bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    bot_ids = [bot.id for bot in user_bots]
    
    if not bot_ids:
        return []
    
    # Запрос тегов
    query = db.query(UserTag).filter(UserTag.bot_id.in_(bot_ids))
    
    # Применяем фильтр по bot_id, если указан
    if bot_id is not None:
        if bot_id not in bot_ids:
            return []  # Бот не принадлежит пользователю
        query = query.filter(UserTag.bot_id == bot_id)
    
    tags = query.order_by(UserTag.created_at.desc()).all()
    
    # Добавляем информацию о боте к каждому тегу
    result = []
    for tag in tags:
        # Находим бота для этого тега
        bot = next((b for b in user_bots if b.id == tag.bot_id), None)
        bot_name = None
        if bot:
            bot_name = bot.name or bot.username or f"Bot #{bot.id}"
        
        result.append(UserTagResponse(
            id=tag.id,
            bot_id=tag.bot_id,
            name=tag.name,
            color=tag.color,
            description=tag.description,
            created_at=tag.created_at,
            bot_name=bot_name
        ))
    
    return result

