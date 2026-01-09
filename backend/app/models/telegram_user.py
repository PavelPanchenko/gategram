from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    LEFT = "left"


class TelegramUser(Base):
    __tablename__ = "telegram_users"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False, index=True)
    telegram_user_id = Column(BigInteger, nullable=False, index=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    source = Column(String, nullable=True, index=True)
    status = Column(String, default=UserStatus.ACTIVE.value)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="telegram_users")
    tags = relationship("UserTag", secondary="user_tags_association", back_populates="users")

