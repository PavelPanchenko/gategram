from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.models.broadcast import BroadcastStatus, MediaType


class BroadcastCreate(BaseModel):
    bot_id: int = Field(..., description="ID бота для отправки")
    message_text: str = Field(..., min_length=1, max_length=4096, description="Текст сообщения")
    template_id: Optional[int] = Field(None, description="ID шаблона (если используется шаблон)")
    media_type: Optional[MediaType] = Field(None, description="Тип медиа (photo, video, document, audio) - для обратной совместимости")
    media_url: Optional[str] = Field(None, description="URL медиа файла или file_id - для обратной совместимости")
    media_files: Optional[List[Dict[str, str]]] = Field(None, description="Массив медиа файлов: [{\"type\": \"photo\", \"url\": \"/path/to/file.jpg\"}, ...]")
    scheduled_at: Optional[datetime] = Field(None, description="Время отправки (если None - отправить сразу)")


class BroadcastUpdate(BaseModel):
    status: Optional[BroadcastStatus] = None


class BroadcastResponse(BaseModel):
    id: int
    bot_id: int
    owner_id: int
    message_text: str
    template_id: Optional[int] = None
    media_type: Optional[str]
    media_url: Optional[str]
    media_files: Optional[List[Dict[str, str]]] = None
    status: str
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_users: int
    sent_count: int
    failed_count: int
    filters: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BroadcastListResponse(BaseModel):
    id: int
    bot_id: int
    message_text: str
    media_type: Optional[str]
    media_url: Optional[str]
    status: str
    scheduled_at: Optional[datetime]
    total_users: int
    sent_count: int
    failed_count: int
    filters: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

