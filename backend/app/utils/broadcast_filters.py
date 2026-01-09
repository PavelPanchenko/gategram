"""Утилиты для фильтрации пользователей при рассылках"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from app.models.telegram_user import TelegramUser, UserStatus
from app.models.user_tag import UserTag
import logging

logger = logging.getLogger(__name__)


def filter_users_for_broadcast(
    db: Session,
    bot_id: int,
    filters: Optional[Dict[str, Any]] = None
) -> List[TelegramUser]:
    """
    Фильтрует пользователей для рассылки на основе условий
    
    Поддерживаемые фильтры:
    - new_users_days: int - новые пользователи (зарегистрировались за последние N дней)
    - inactive_days: int - неактивные пользователи (не заходили N дней)
    - source: str - фильтр по источнику
    - tags: List[str] - фильтр по тегам (пользователь должен иметь все указанные теги)
    
    Примечание: Рассылка всегда отправляется только активным пользователям (status='active'),
    так как заблокированным пользователям отправить сообщение невозможно.
    """
    if not filters:
        filters = {}
    
    # Базовый запрос - только активные пользователи бота
    # Всегда фильтруем только активных, так как заблокированным отправить нельзя
    query = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.status == UserStatus.ACTIVE.value
    )
    
    # Фильтр по новым пользователям
    if 'new_users_days' in filters:
        days = filters['new_users_days']
        if isinstance(days, int) and days > 0:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(TelegramUser.joined_at >= cutoff_date)
            logger.info(f"Filtering new users: registered in last {days} days")
    
    # Фильтр по неактивным пользователям
    if 'inactive_days' in filters:
        days = filters['inactive_days']
        if isinstance(days, int) and days > 0:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(TelegramUser.last_activity < cutoff_date)
            logger.info(f"Filtering inactive users: no activity for {days} days")
    
    # Фильтр по источнику
    if 'source' in filters:
        source = filters['source']
        if source:
            query = query.filter(TelegramUser.source == source)
            logger.info(f"Filtering by source: {source}")
    
    # Фильтр по тегам
    if 'tags' in filters:
        tags = filters['tags']
        if isinstance(tags, list) and len(tags) > 0:
            # Получаем ID тегов по именам
            tag_objects = db.query(UserTag).filter(
                UserTag.bot_id == bot_id,
                UserTag.name.in_(tags)
            ).all()
            
            if tag_objects:
                tag_ids = [tag.id for tag in tag_objects]
                # Фильтруем пользователей, у которых есть все указанные теги
                # Используем подзапрос для проверки наличия всех тегов
                from sqlalchemy import exists
                from app.models.user_tag import user_tags_association
                
                # Для каждого тега проверяем, что пользователь имеет этот тег
                for tag_id in tag_ids:
                    query = query.filter(
                        exists().where(
                            and_(
                                user_tags_association.c.telegram_user_id == TelegramUser.id,
                                user_tags_association.c.tag_id == tag_id
                            )
                        )
                    )
                logger.info(f"Filtering by tags: {tags}")
            else:
                # Если теги не найдены, возвращаем пустой список
                logger.warning(f"Tags not found: {tags}")
                return []
    
    users = query.all()
    logger.info(f"Filtered {len(users)} users for broadcast with filters: {filters}")
    
    return users

