from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.message_template import MessageTemplate
from app.schemas.message_template import MessageTemplateCreate, MessageTemplateUpdate, MessageTemplateResponse
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bots/{bot_id}/templates", tags=["message-templates"])


@router.get("", response_model=List[MessageTemplateResponse])
async def get_templates(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все шаблоны сообщений для бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    templates = db.query(MessageTemplate).filter(MessageTemplate.bot_id == bot_id).all()
    return templates


@router.get("/{template_id}", response_model=MessageTemplateResponse)
async def get_template(
    bot_id: int,
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить шаблон по ID"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    template = db.query(MessageTemplate).filter(
        MessageTemplate.id == template_id,
        MessageTemplate.bot_id == bot_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return template


@router.post("", response_model=MessageTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    bot_id: int,
    template_data: MessageTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый шаблон"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    new_template = MessageTemplate(
        bot_id=bot_id,
        **template_data.model_dump()
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return new_template


@router.put("/{template_id}", response_model=MessageTemplateResponse)
async def update_template(
    bot_id: int,
    template_id: int,
    template_data: MessageTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить шаблон"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    template = db.query(MessageTemplate).filter(
        MessageTemplate.id == template_id,
        MessageTemplate.bot_id == bot_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    bot_id: int,
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить шаблон"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    template = db.query(MessageTemplate).filter(
        MessageTemplate.id == template_id,
        MessageTemplate.bot_id == bot_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    db.delete(template)
    db.commit()
    return None

