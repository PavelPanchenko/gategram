from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from fastapi.datastructures import UploadFile as FastAPIUploadFile
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import uuid
import json
import logging
from pathlib import Path
from app.core.database import get_db
from app.core.config import settings
from app.models.broadcast import Broadcast, BroadcastStatus
from app.models.bot import Bot
from app.models.telegram_user import TelegramUser
from app.schemas.broadcast import BroadcastCreate, BroadcastResponse, BroadcastListResponse
from app.utils.dependencies import get_current_user
from app.utils.broadcast_filters import filter_users_for_broadcast
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])

# Создаем папку для медиа файлов
MEDIA_DIR = Path("/app/media/broadcasts")  # Абсолютный путь для Docker
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
logger.info(f"Media directory: {MEDIA_DIR}, exists: {MEDIA_DIR.exists()}")


def delete_media_file(media_url: Optional[str]) -> bool:
    """Удаляет медиа файл с диска"""
    if not media_url:
        return False
    
    try:
        media_path = Path(media_url)
        # Пробуем разные варианты пути
        possible_paths = [
            media_path,
            media_path.absolute(),
            MEDIA_DIR / media_path.name,
            MEDIA_DIR / Path(media_url).name,
        ]
        
        deleted = False
        for path in possible_paths:
            if path.exists() and path.is_file():
                path.unlink()
                logger.info(f"Deleted media file: {path}")
                deleted = True
                break
        
        if not deleted:
            logger.warning(f"Media file not found for deletion: {media_url}")
        
        return deleted
    except Exception as e:
        logger.error(f"Error deleting media file {media_url}: {e}", exc_info=True)
        return False


@router.get("", response_model=List[BroadcastListResponse])
async def get_broadcasts(
    bot_id: Optional[int] = Query(None, description="Фильтр по ID бота"),
    status_filter: Optional[BroadcastStatus] = Query(None, description="Фильтр по статусу"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список рассылок"""
    query = db.query(Broadcast).filter(Broadcast.owner_id == current_user.id)
    
    if bot_id:
        # Проверяем, что бот принадлежит пользователю
        bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
        if not bot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )
        query = query.filter(Broadcast.bot_id == bot_id)
    
    if status_filter:
        query = query.filter(Broadcast.status == status_filter.value)
    
    broadcasts = query.order_by(Broadcast.created_at.desc()).offset(skip).limit(limit).all()
    return broadcasts


@router.get("/{broadcast_id}", response_model=BroadcastResponse)
async def get_broadcast(
    broadcast_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о рассылке"""
    broadcast = db.query(Broadcast).filter(
        Broadcast.id == broadcast_id,
        Broadcast.owner_id == current_user.id
    ).first()
    
    if not broadcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broadcast not found"
        )
    
    return broadcast


@router.post("", response_model=BroadcastResponse, status_code=status.HTTP_201_CREATED)
async def create_broadcast(
    request: Request,
    bot_id: int = Form(...),
    message_text: str = Form(...),
    template_id: Optional[int] = Form(None),
    media_type: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    scheduled_at: Optional[str] = Form(None),
    filters: Optional[str] = Form(None),  # JSON строка с фильтрами
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новую рассылку с возможностью загрузки медиа файла"""
    # Валидация message_text вручную, чтобы избежать проблем с сериализацией бинарных данных
    if not message_text or len(message_text.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="message_text is required and cannot be empty"
        )
    if len(message_text) > 4096:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="message_text cannot exceed 4096 characters"
        )
    
    # Проверяем, что бот принадлежит пользователю
    bot = db.query(Bot).filter(
        Bot.id == bot_id,
        Bot.owner_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    if not bot.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot is not active"
        )
    
    # Парсим фильтры
    filters_dict: Optional[Dict[str, Any]] = None
    if filters:
        try:
            filters_dict = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filters JSON format"
            )
    
    # Подсчитываем количество пользователей для рассылки с учетом фильтров
    filtered_users = filter_users_for_broadcast(
        db=db,
        bot_id=bot.id,
        filters=filters_dict if filters_dict else {}
    )
    total_users = len(filtered_users)
    
    if total_users == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No users match the specified filters for this bot"
        )
    
    # Обрабатываем загруженные файлы (поддержка медиа-групп)
    media_url = None
    final_media_type = None
    media_files_list = []
    
    # Получаем множественные файлы из формы
    form = await request.form()
    media_files = form.getlist("media_files")  # Получаем список файлов с именем "media_files"
    
    # Обрабатываем множественные файлы (приоритет над одиночным файлом)
    if media_files and len(media_files) > 0:
        # Ограничиваем до 10 файлов (лимит Telegram для медиа-групп)
        files_to_process = media_files[:10]
        
        for idx, file_item in enumerate(files_to_process):
            # file_item может быть строкой или UploadFile
            if isinstance(file_item, str):
                continue
            if not hasattr(file_item, 'filename') or not file_item.filename:
                continue
                
            file_ext = Path(file_item.filename).suffix if file_item.filename else ""
            file_name = f"{uuid.uuid4()}{file_ext}"
            file_path = MEDIA_DIR / file_name
            
            logger.info(f"Saving media file {idx + 1}/{len(files_to_process)}: {file_path}, filename: {file_item.filename}")
            
            try:
                with open(file_path, "wb") as f:
                    content = await file_item.read()
                    f.write(content)
                
                if file_path.exists():
                    # Автоматически определяем тип медиа
                    file_ext_lower = file_ext.lower()
                    if file_ext_lower in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        file_type = 'photo'
                    elif file_ext_lower in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
                        file_type = 'video'
                    elif file_ext_lower in ['.mp3', '.wav', '.ogg', '.m4a']:
                        file_type = 'audio'
                    else:
                        file_type = 'document'
                    
                    media_files_list.append({
                        "type": file_type,
                        "url": str(file_path.absolute())
                    })
                    logger.info(f"Media file {idx + 1} saved: {file_path}, type: {file_type}")
                else:
                    logger.error(f"Failed to save media file {idx + 1}: {file_path}")
            except Exception as e:
                logger.error(f"Error saving media file {idx + 1}: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to save media file {idx + 1}: {str(e)}"
                )
    
    # Обрабатываем одиночный файл (для обратной совместимости)
    elif media_file and media_file.filename:
        # Сохраняем файл в любом случае, если он загружен
        file_ext = Path(media_file.filename).suffix if media_file.filename else ""
        file_name = f"{uuid.uuid4()}{file_ext}"
        file_path = MEDIA_DIR / file_name
        
        logger.info(f"Saving media file: {file_path}, filename: {media_file.filename}")
        
        # Сохраняем файл
        try:
            with open(file_path, "wb") as f:
                content = await media_file.read()
                f.write(content)
            
            # Проверяем, что файл сохранился
            if file_path.exists():
                file_size = file_path.stat().st_size
                logger.info(f"Media file saved successfully: {file_path}, size: {file_size} bytes")
                
                # Автоматически определяем тип медиа, если не указан
                if not media_type or media_type == "none":
                    file_ext_lower = file_ext.lower()
                    if file_ext_lower in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        final_media_type = 'photo'
                    elif file_ext_lower in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
                        final_media_type = 'video'
                    elif file_ext_lower in ['.mp3', '.wav', '.ogg', '.m4a']:
                        final_media_type = 'audio'
                    else:
                        final_media_type = 'document'
                    logger.info(f"Auto-detected media type: {final_media_type}")
                else:
                    final_media_type = media_type
                
                # Сохраняем абсолютный путь для использования в Celery
                media_url = str(file_path.absolute())
                logger.info(f"Media URL saved to broadcast: {media_url}, type: {final_media_type}")
            else:
                logger.error(f"Failed to save media file: {file_path}")
        except Exception as e:
            logger.error(f"Error saving media file: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save media file: {str(e)}"
            )
    
    # Парсим scheduled_at если есть
    scheduled_datetime = None
    if scheduled_at:
        try:
            scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid scheduled_at format"
            )
    
    # Определяем статус
    broadcast_status = BroadcastStatus.SCHEDULED if scheduled_datetime else BroadcastStatus.PENDING
    
    # Проверяем template_id, если указан
    template_id_value = None
    if template_id:
        from app.models.message_template import MessageTemplate
        template = db.query(MessageTemplate).filter(
            MessageTemplate.id == template_id,
            MessageTemplate.bot_id == bot_id,
            MessageTemplate.is_active == True
        ).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found or inactive"
            )
        template_id_value = template_id
    
    # Создаем рассылку
    broadcast = Broadcast(
        bot_id=bot_id,
        owner_id=current_user.id,
        message_text=message_text,
        template_id=template_id_value,
        media_type=final_media_type,
        media_url=media_url,
        media_files=media_files_list if media_files_list else None,
        status=broadcast_status.value,
        scheduled_at=scheduled_datetime,
        total_users=total_users,
        filters=filters_dict
    )
    
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)
    
    # Запускаем Celery задачу для отправки
    if broadcast_status == BroadcastStatus.PENDING:
        from app.tasks.broadcast_tasks import send_broadcast_task
        send_broadcast_task.delay(broadcast.id)
    # Если статус SCHEDULED, задача будет запущена по расписанию через Celery Beat
    
    return broadcast


@router.post("/{broadcast_id}/cancel", response_model=BroadcastResponse)
async def cancel_broadcast(
    broadcast_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отменить рассылку"""
    broadcast = db.query(Broadcast).filter(
        Broadcast.id == broadcast_id,
        Broadcast.owner_id == current_user.id
    ).first()
    
    if not broadcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broadcast not found"
        )
    
    # Можно отменить только pending или scheduled рассылки
    if broadcast.status not in [BroadcastStatus.PENDING.value, BroadcastStatus.SCHEDULED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel broadcast with status {broadcast.status}"
        )
    
    broadcast.status = BroadcastStatus.CANCELLED.value
    
    # Удаляем медиа файл при отмене
    if broadcast.media_url:
        delete_media_file(broadcast.media_url)
        # Очищаем media_url и media_type в БД
        broadcast.media_url = None
        broadcast.media_type = None
    
    db.commit()
    db.refresh(broadcast)
    
    # TODO: Отменить Celery задачу, если она запущена
    
    return broadcast


@router.delete("/{broadcast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_broadcast(
    broadcast_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить рассылку и связанные медиа файлы"""
    broadcast = db.query(Broadcast).filter(
        Broadcast.id == broadcast_id,
        Broadcast.owner_id == current_user.id
    ).first()
    
    if not broadcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broadcast not found"
        )
    
    # Удаляем медиа файл, если он есть
    if broadcast.media_url:
        delete_media_file(broadcast.media_url)
    
    # Удаляем рассылку из БД (логи удалятся каскадно благодаря cascade)
    db.delete(broadcast)
    db.commit()
    
    logger.info(f"Broadcast {broadcast_id} deleted by user {current_user.id}")
    
    return None

