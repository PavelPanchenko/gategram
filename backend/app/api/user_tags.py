from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.user_tag import UserTag
from app.models.telegram_user import TelegramUser
from app.schemas.user_tag import UserTagCreate, UserTagUpdate, UserTagResponse, AssignTagsRequest
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bots/{bot_id}/tags", tags=["user-tags"])


@router.get("", response_model=List[UserTagResponse])
async def get_tags(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все теги для бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    tags = db.query(UserTag).filter(UserTag.bot_id == bot_id).all()
    return tags


@router.post("", response_model=UserTagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    bot_id: int,
    tag_data: UserTagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый тег"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Проверяем, нет ли тега с таким именем
    existing_tag = db.query(UserTag).filter(
        UserTag.bot_id == bot_id,
        UserTag.name == tag_data.name
    ).first()
    
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists"
        )
    
    new_tag = UserTag(
        bot_id=bot_id,
        **tag_data.model_dump()
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return new_tag


@router.put("/{tag_id}", response_model=UserTagResponse)
async def update_tag(
    bot_id: int,
    tag_id: int,
    tag_data: UserTagUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить тег"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.bot_id == bot_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    update_data = tag_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tag, field, value)
    
    db.commit()
    db.refresh(tag)
    
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    bot_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить тег"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.bot_id == bot_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    db.delete(tag)
    db.commit()
    return None


@router.post("/{tag_id}/assign", status_code=status.HTTP_200_OK)
async def assign_tag_to_users(
    bot_id: int,
    tag_id: int,
    request: AssignTagsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Назначить тег пользователям"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.bot_id == bot_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Получаем пользователей
    users = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.id.in_(request.tag_ids)
    ).all()
    
    # Назначаем тег
    for user in users:
        if tag not in user.tags:
            user.tags.append(tag)
    
    db.commit()
    
    return {"message": f"Tag assigned to {len(users)} users"}


@router.post("/users/{user_id}/assign", status_code=status.HTTP_200_OK)
async def assign_tags_to_user(
    bot_id: int,
    user_id: int,
    request: AssignTagsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Назначить теги пользователю"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    user = db.query(TelegramUser).filter(
        TelegramUser.id == user_id,
        TelegramUser.bot_id == bot_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Получаем теги
    tags = db.query(UserTag).filter(
        UserTag.bot_id == bot_id,
        UserTag.id.in_(request.tag_ids)
    ).all()
    
    # Назначаем теги
    user.tags = tags
    db.commit()
    
    return {"message": f"Assigned {len(tags)} tags to user"}

