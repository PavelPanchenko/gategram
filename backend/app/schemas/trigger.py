from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from app.models.trigger import TriggerEvent, TriggerAction


class TriggerCreate(BaseModel):
    """Схема для создания триггера"""
    name: str = Field(..., min_length=1, max_length=100, description="Название триггера")
    event_type: str = Field(..., description="Тип события")
    conditions: Dict[str, Any] = Field(default={}, description="Условия триггера")
    action_type: str = Field(..., description="Тип действия")
    action_data: Dict[str, Any] = Field(default={}, description="Данные действия")
    is_active: bool = Field(default=True, description="Активен ли триггер")


class TriggerUpdate(BaseModel):
    """Схема для обновления триггера"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    event_type: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    action_type: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TriggerResponse(BaseModel):
    """Схема ответа для триггера"""
    id: int
    bot_id: int
    name: str
    event_type: str
    conditions: Dict[str, Any]
    action_type: str
    action_data: Dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    bot_name: Optional[str] = None  # Название бота (для глобальных запросов)

    class Config:
        from_attributes = True

