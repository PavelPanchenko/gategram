from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserTagInfo(BaseModel):
    """Информация о теге пользователя"""
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class TelegramUserResponse(BaseModel):
    id: int
    bot_id: int
    bot_name: Optional[str] = None  # Добавлено для глобального просмотра
    telegram_user_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    source: Optional[str]
    status: str
    joined_at: datetime
    last_activity: datetime
    tags: List[UserTagInfo] = []  # Добавлено для отображения тегов

    class Config:
        from_attributes = True

