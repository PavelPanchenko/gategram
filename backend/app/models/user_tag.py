from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Связующая таблица для many-to-many между пользователями и тегами
user_tags_association = Table(
    'user_tags_association',
    Base.metadata,
    Column('telegram_user_id', Integer, ForeignKey('telegram_users.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('user_tags.id'), primary_key=True)
)


class UserTag(Base):
    """Тег для сегментации пользователей"""
    __tablename__ = "user_tags"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)  # Название тега
    color = Column(String, default="#3B82F6")  # Цвет тега для UI
    description = Column(String, nullable=True)  # Описание тега
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="user_tags")
    users = relationship("TelegramUser", secondary=user_tags_association, back_populates="tags")

