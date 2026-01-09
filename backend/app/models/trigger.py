from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class TriggerEvent(str, enum.Enum):
    """Типы событий для триггеров"""
    USER_REGISTERED = "user_registered"  # Пользователь зарегистрировался
    USER_INACTIVE = "user_inactive"  # Пользователь неактивен N дней
    USER_JOINED_CHANNEL = "user_joined_channel"  # Пользователь присоединился к каналу
    USER_LEFT_CHANNEL = "user_left_channel"  # Пользователь отписался от канала


class TriggerAction(str, enum.Enum):
    """Типы действий триггера"""
    SEND_MESSAGE = "send_message"  # Отправить сообщение
    ADD_TAG = "add_tag"  # Добавить тег
    REMOVE_TAG = "remove_tag"  # Удалить тег


class Trigger(Base):
    """Автоматический триггер для действий с пользователями"""
    __tablename__ = "triggers"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # Название триггера
    event_type = Column(String, nullable=False)  # Тип события (TriggerEvent)
    conditions = Column(JSON, default={})  # Условия: {"days_inactive": 7, "source": "ad1", ...}
    action_type = Column(String, nullable=False)  # Тип действия (TriggerAction)
    action_data = Column(JSON, default={})  # Данные действия: {"message": "...", "tag_id": 1, ...}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="triggers")

