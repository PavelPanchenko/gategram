from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserTagCreate(BaseModel):
    """Схема для создания тега"""
    name: str = Field(..., min_length=1, max_length=50, description="Название тега")
    color: str = Field(default="#3B82F6", description="Цвет тега")
    description: Optional[str] = Field(None, max_length=200, description="Описание тега")


class UserTagUpdate(BaseModel):
    """Схема для обновления тега"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None
    description: Optional[str] = Field(None, max_length=200)


class UserTagResponse(BaseModel):
    """Схема ответа для тега"""
    id: int
    bot_id: int
    name: str
    color: str
    description: Optional[str]
    created_at: datetime
    bot_name: Optional[str] = None  # Название бота (для глобальных запросов)

    class Config:
        from_attributes = True


class AssignTagsRequest(BaseModel):
    """Схема для назначения тегов пользователю"""
    tag_ids: List[int] = Field(..., description="Список ID тегов для назначения")

