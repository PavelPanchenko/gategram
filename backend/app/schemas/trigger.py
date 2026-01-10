from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.models.trigger import TriggerEvent, TriggerAction


class TriggerActionItem(BaseModel):
    """Схема для одного действия в триггере"""
    type: str = Field(..., description="Тип действия (send_message, add_tag, remove_tag)")
    data: Dict[str, Any] = Field(default_factory=dict, description="Данные действия")


class TriggerCreate(BaseModel):
    """Схема для создания триггера"""
    name: str = Field(..., min_length=1, max_length=100, description="Название триггера")
    event_type: str = Field(..., description="Тип события")
    conditions: Dict[str, Any] = Field(default_factory=dict, description="Условия триггера")
    actions: List[TriggerActionItem] = Field(default_factory=list, description="Массив действий триггера")
    is_active: bool = Field(default=True, description="Активен ли триггер")
    
    # Старые поля (для обратной совместимости, deprecated)
    action_type: Optional[str] = Field(None, description="Тип действия (deprecated, используйте actions)")
    action_data: Optional[Dict[str, Any]] = Field(None, description="Данные действия (deprecated, используйте actions)")


class TriggerUpdate(BaseModel):
    """Схема для обновления триггера"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    event_type: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[List[TriggerActionItem]] = None
    is_active: Optional[bool] = None
    
    # Старые поля (для обратной совместимости, deprecated)
    action_type: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None


class TriggerResponse(BaseModel):
    """Схема ответа для триггера"""
    id: int
    bot_id: int
    name: str
    event_type: str
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]] = Field(default_factory=list)  # Новое поле: массив действий
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    bot_name: Optional[str] = None  # Название бота (для глобальных запросов)
    
    # Старые поля (для обратной совместимости)
    action_type: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

