from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.schemas.channel import Channel


class TokenValidateRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Telegram bot token")


class BotCreate(BaseModel):
    token: str = Field(..., min_length=1, description="Telegram bot token")
    name: Optional[str] = None
    welcome_message: Optional[str] = None
    required_interaction: bool = True
    interaction_delay_seconds: int = Field(default=5, ge=0, le=300)
    continue_button_text: Optional[str] = Field(default="✅ Продолжить", description="Текст кнопки 'Продолжить'")
    channel_link: Optional[str] = None  # Для обратной совместимости
    channels: Optional[List[Channel]] = Field(default=[], description="Список каналов")
    settings: Optional[Dict[str, Any]] = None


class BotUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    welcome_message: Optional[str] = None
    required_interaction: Optional[bool] = None
    interaction_delay_seconds: Optional[int] = Field(None, ge=0, le=300)
    continue_button_text: Optional[str] = Field(None, description="Текст кнопки 'Продолжить'")
    channel_link: Optional[str] = None  # Для обратной совместимости
    channels: Optional[List[Channel]] = None
    settings: Optional[Dict[str, Any]] = None


class BotResponse(BaseModel):
    id: int
    owner_id: int
    token: str
    username: Optional[str]
    name: Optional[str]
    is_active: bool
    welcome_message: Optional[str]
    required_interaction: bool
    interaction_delay_seconds: int
    continue_button_text: str
    channel_link: Optional[str]  # Для обратной совместимости
    channels: List[Dict[str, Any]] = Field(default=[], description="Список каналов")
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BotListResponse(BaseModel):
    id: int
    username: Optional[str]
    name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

