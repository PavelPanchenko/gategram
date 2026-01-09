from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class MessageTemplateCreate(BaseModel):
    """Схема для создания шаблона сообщения"""
    name: str = Field(..., min_length=1, max_length=100, description="Название шаблона")
    content: str = Field(..., min_length=1, description="Содержимое шаблона с переменными")
    variables: Optional[Dict[str, str]] = Field(default={}, description="Описание переменных")
    is_active: bool = Field(default=True, description="Активен ли шаблон")


class MessageTemplateUpdate(BaseModel):
    """Схема для обновления шаблона сообщения"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=1)
    variables: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None


class MessageTemplateResponse(BaseModel):
    """Схема ответа для шаблона сообщения"""
    id: int
    bot_id: int
    name: str
    content: str
    variables: Dict[str, str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    bot_name: Optional[str] = None  # Название бота (для глобальных запросов)

    class Config:
        from_attributes = True

