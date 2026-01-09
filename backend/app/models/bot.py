from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, nullable=True)
    name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Bot settings
    welcome_message = Column(Text, nullable=True)
    required_interaction = Column(Boolean, default=True)
    interaction_delay_seconds = Column(Integer, default=5)
    continue_button_text = Column(String, default="✅ Продолжить")  # Текст кнопки "Продолжить"
    channel_link = Column(String, nullable=True)  # Оставляем для обратной совместимости
    channels = Column(JSON, default=[])  # Массив каналов: [{"name": "Канал 1", "url": "https://..."}, ...]
    
    # Metadata
    settings = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="bots")
    telegram_users = relationship("TelegramUser", back_populates="bot", cascade="all, delete-orphan")
    broadcasts = relationship("Broadcast", back_populates="bot", cascade="all, delete-orphan")
    message_templates = relationship("MessageTemplate", back_populates="bot", cascade="all, delete-orphan")
    user_tags = relationship("UserTag", back_populates="bot", cascade="all, delete-orphan")
    triggers = relationship("Trigger", back_populates="bot", cascade="all, delete-orphan")

