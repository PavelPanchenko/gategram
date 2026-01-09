from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class MessageTemplate(Base):
    """Шаблон сообщения для бота"""
    __tablename__ = "message_templates"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # Название шаблона
    content = Column(Text, nullable=False)  # Содержимое шаблона с переменными
    variables = Column(JSON, default={})  # Описание переменных: {"user_name": "Имя пользователя", ...}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="message_templates")

