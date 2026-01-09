from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.telegram_user import TelegramUser
from app.schemas.telegram_user import TelegramUserResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["users-global"])


@router.get("", response_model=List[TelegramUserResponse])
async def get_all_users(
    bot_id: Optional[int] = Query(None, description="Фильтр по ID бота"),
    status_filter: Optional[str] = Query(None, description="Фильтр по статусу (active, blocked, left)"),
    source_filter: Optional[str] = Query(None, description="Фильтр по источнику"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить всех пользователей всех ботов пользователя, с возможностью фильтрации"""
    # Получаем все боты пользователя
    user_bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    bot_ids = [bot.id for bot in user_bots]
    
    if not bot_ids:
        return []
    
    # Запрос пользователей
    query = db.query(TelegramUser).filter(TelegramUser.bot_id.in_(bot_ids))
    
    # Применяем фильтр по bot_id, если указан
    if bot_id is not None:
        if bot_id not in bot_ids:
            return []  # Бот не принадлежит пользователю
        query = query.filter(TelegramUser.bot_id == bot_id)
    
    # Применяем фильтр по статусу
    if status_filter:
        query = query.filter(TelegramUser.status == status_filter)
    
    # Применяем фильтр по источнику
    if source_filter:
        query = query.filter(TelegramUser.source == source_filter)
    
    users = query.order_by(TelegramUser.joined_at.desc()).offset(skip).limit(limit).all()
    
    # Добавляем информацию о боте к каждому пользователю
    result = []
    for user in users:
        bot = next((b for b in user_bots if b.id == user.bot_id), None)
        bot_name = None
        if bot:
            bot_name = bot.name or bot.username or f"Bot #{bot.id}"
        
        # Создаем ответ с информацией о боте
        user_response = TelegramUserResponse(
            id=user.id,
            bot_id=user.bot_id,
            bot_name=bot_name,
            telegram_user_id=user.telegram_user_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            source=user.source,
            status=user.status,
            joined_at=user.joined_at,
            last_activity=user.last_activity,
            tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in user.tags]
        )
        result.append(user_response)
    
    return result

