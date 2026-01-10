from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.trigger import Trigger
from app.schemas.trigger import TriggerCreate, TriggerUpdate, TriggerResponse
from app.utils.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bots/{bot_id}/triggers", tags=["triggers"])


@router.get("", response_model=List[TriggerResponse])
async def get_triggers(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все триггеры для бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    triggers = db.query(Trigger).filter(Trigger.bot_id == bot_id).all()
    return triggers


@router.get("/{trigger_id}", response_model=TriggerResponse)
async def get_trigger(
    bot_id: int,
    trigger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить триггер по ID"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    trigger = db.query(Trigger).filter(
        Trigger.id == trigger_id,
        Trigger.bot_id == bot_id
    ).first()
    
    if not trigger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trigger not found"
        )
    
    return trigger


@router.post("", response_model=TriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(
    bot_id: int,
    trigger_data: TriggerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый триггер"""
    logger.info(f"Creating trigger for bot {bot_id}. Data: {trigger_data.model_dump()}")
    
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    new_trigger = Trigger(
        bot_id=bot_id,
        **trigger_data.model_dump()
    )
    db.add(new_trigger)
    db.commit()
    db.refresh(new_trigger)
    
    return new_trigger


@router.put("/{trigger_id}", response_model=TriggerResponse)
async def update_trigger(
    bot_id: int,
    trigger_id: int,
    trigger_data: TriggerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить триггер"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    trigger = db.query(Trigger).filter(
        Trigger.id == trigger_id,
        Trigger.bot_id == bot_id
    ).first()
    
    if not trigger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trigger not found"
        )
    
    update_data = trigger_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trigger, field, value)
    
    db.commit()
    db.refresh(trigger)
    
    return trigger


@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(
    bot_id: int,
    trigger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить триггер"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    trigger = db.query(Trigger).filter(
        Trigger.id == trigger_id,
        Trigger.bot_id == bot_id
    ).first()
    
    if not trigger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trigger not found"
        )
    
    db.delete(trigger)
    db.commit()
    return None

