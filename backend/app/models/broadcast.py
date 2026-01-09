from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum, BigInteger, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class BroadcastStatus(str, enum.Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MediaType(str, enum.Enum):
    """Типы медиа для рассылок"""
    PHOTO = "photo"
    VIDEO = "video"
    DOCUMENT = "document"
    AUDIO = "audio"


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message_text = Column(Text, nullable=False)
    template_id = Column(Integer, ForeignKey("message_templates.id"), nullable=True, index=True)  # ID шаблона (если используется)
    media_type = Column(String, nullable=True)  # photo, video, document, audio (для обратной совместимости)
    media_url = Column(String, nullable=True)  # URL или file_id (для обратной совместимости)
    media_files = Column(JSON, nullable=True)  # Массив медиа файлов: [{"type": "photo", "url": "/path/to/file.jpg"}, ...]
    status = Column(String, default=BroadcastStatus.PENDING.value, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    total_users = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    filters = Column(JSON, default={})  # Фильтры пользователей: {"new_users_days": 7, "inactive_days": 30, "source": "ad1", "tags": ["vip"], ...}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="broadcasts")
    logs = relationship("BroadcastLog", back_populates="broadcast", cascade="all, delete-orphan")


class BroadcastLog(Base):
    __tablename__ = "broadcast_logs"

    id = Column(Integer, primary_key=True, index=True)
    broadcast_id = Column(Integer, ForeignKey("broadcasts.id"), nullable=False, index=True)
    telegram_user_id = Column(BigInteger, nullable=False, index=True)
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    broadcast = relationship("Broadcast", back_populates="logs")

