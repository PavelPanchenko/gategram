from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.bot import Bot
from app.models.telegram_user import TelegramUser
from app.schemas.bot import BotCreate, BotUpdate, BotResponse, BotListResponse, TokenValidateRequest
from app.schemas.telegram_user import TelegramUserResponse
from app.schemas.user_action import SendMessageRequest, BlockUserRequest
from app.utils.dependencies import get_current_user
from app.utils.telegram import validate_telegram_token, get_channel_info, normalize_channel_url
from app.services.bot_manager import bot_manager
from app.services.bot_handlers import setup_bot_handlers
from aiogram import Bot as AiogramBot
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram import Router
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bots", tags=["bots"])


@router.get("/channel-info")
async def get_channel_info_endpoint(
    url: str = Query(..., description="URL канала для получения информации (поддерживает @username и полные URL)"),
    current_user: User = Depends(get_current_user)
):
    """Получить информацию о канале по URL или username"""
    import urllib.parse
    
    try:
        # Декодируем URL если он был закодирован (например, %40 -> @)
        # FastAPI автоматически декодирует URL параметры, но на всякий случай делаем еще раз
        decoded_url = urllib.parse.unquote(url)
        logger.info(f"Channel info request - Original: {url}, Decoded: {decoded_url}")
        
        # Нормализуем URL перед получением информации
        normalized_url = normalize_channel_url(decoded_url)
        channel_name = await get_channel_info(decoded_url)  # Используем декодированный URL для извлечения имени
        
        logger.info(f"Channel info result - Name: {channel_name}, Normalized URL: {normalized_url}")
        
        if channel_name:
            return {"name": channel_name, "normalized_url": normalized_url}
        return {"name": None, "normalized_url": normalized_url}
    except Exception as e:
        logger.error(f"Error getting channel info for {url}: {e}", exc_info=True)
        # Возвращаем нормализованный URL даже при ошибке
        try:
            decoded_url = urllib.parse.unquote(url)
            normalized_url = normalize_channel_url(decoded_url)
            return {"name": None, "normalized_url": normalized_url}
        except Exception as e2:
            logger.error(f"Error normalizing URL {url}: {e2}")
            return {"name": None, "normalized_url": url}


@router.get("", response_model=List[BotListResponse])
async def get_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех ботов пользователя"""
    bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    return bots


@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о конкретном боте"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    return bot


@router.post("", response_model=BotResponse, status_code=status.HTTP_201_CREATED)
async def create_bot(
    bot_data: BotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать нового бота"""
    # Проверяем, существует ли бот с таким токеном
    existing_bot = db.query(Bot).filter(Bot.token == bot_data.token).first()
    if existing_bot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot with this token already exists"
        )
    
    # Валидируем токен через Telegram API
    bot_info = await validate_telegram_token(bot_data.token)
    if not bot_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Telegram bot token"
        )
    
    # Подготавливаем каналы
    channels_data = []
    if bot_data.channels:
        # Нормализуем URL каналов
        channels_data = [
            {"name": ch.name, "url": normalize_channel_url(ch.url)} 
            for ch in bot_data.channels
        ]
    elif bot_data.channel_link:
        # Если есть старый channel_link, добавляем его в channels
        channels_data = [{"name": "Канал", "url": normalize_channel_url(bot_data.channel_link)}]
    
    # Создаем бота
    new_bot = Bot(
        owner_id=current_user.id,
        token=bot_data.token,
        username=bot_info.get("username"),
        name=bot_data.name or bot_info.get("first_name"),
        is_active=True,
        welcome_message=bot_data.welcome_message,
        required_interaction=bot_data.required_interaction,
        interaction_delay_seconds=bot_data.interaction_delay_seconds,
        continue_button_text=bot_data.continue_button_text or "✅ Продолжить",
        channel_link=bot_data.channel_link,  # Оставляем для обратной совместимости
        channels=channels_data,
        settings=bot_data.settings or {}
    )
    db.add(new_bot)
    db.commit()
    db.refresh(new_bot)
    
    # Запускаем бота, если он активен
    if new_bot.is_active:
        await bot_manager.start_bot(new_bot.id, new_bot.token, setup_bot_handlers)
    
    return new_bot


@router.put("/{bot_id}", response_model=BotResponse)
async def update_bot(
    bot_id: int,
    bot_data: BotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить информацию о боте"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Сохраняем старое состояние is_active
    old_is_active = bot.is_active
    
    # Обновляем поля
    update_data = bot_data.model_dump(exclude_unset=True)
    
    # Обрабатываем channels отдельно
    if 'channels' in update_data and update_data['channels'] is not None:
        # Нормализуем URL каналов
        # После model_dump() channels могут быть словарями или объектами Channel
        channels_data = []
        for ch in update_data['channels']:
            if isinstance(ch, dict):
                # Если это словарь (после model_dump)
                ch_name = ch.get('name', '').strip()
                ch_url = ch.get('url', '').strip()
                # Пропускаем пустые каналы
                if not ch_name or not ch_url:
                    continue
                channels_data.append({
                    "name": ch_name,
                    "url": normalize_channel_url(ch_url)
                })
            else:
                # Если это объект Channel
                ch_name = (ch.name or '').strip()
                ch_url = (ch.url or '').strip()
                # Пропускаем пустые каналы
                if not ch_name or not ch_url:
                    continue
                channels_data.append({
                    "name": ch_name,
                    "url": normalize_channel_url(ch_url)
                })
        bot.channels = channels_data
        # Если есть старый channel_link и его нет в channels, добавляем
        if bot.channel_link:
            normalized_link = normalize_channel_url(bot.channel_link)
            if not any(ch.get('url') == normalized_link for ch in channels_data):
                channels_data.append({"name": "Канал", "url": normalized_link})
                bot.channels = channels_data
        del update_data['channels']
    
    for field, value in update_data.items():
        setattr(bot, field, value)
    
    db.commit()
    db.refresh(bot)
    
    # Управляем запуском/остановкой бота
    is_running = bot_manager.is_running(bot_id)
    
    if bot.is_active and not is_running:
        # Запускаем бота
        logger.info(f"Starting bot {bot_id} after update")
        success = await bot_manager.start_bot(bot_id, bot.token, setup_bot_handlers)
        if not success:
            logger.error(f"Failed to start bot {bot_id} after update")
    elif not bot.is_active and is_running:
        # Останавливаем бота
        logger.info(f"Stopping bot {bot_id} after update")
        await bot_manager.stop_bot(bot_id)
    elif bot.is_active and is_running and old_is_active != bot.is_active:
        # Перезапускаем бота при изменении настроек
        logger.info(f"Restarting bot {bot_id} after update")
        await bot_manager.restart_bot(bot_id, bot.token, setup_bot_handlers)
    
    return bot


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Останавливаем бота, если он запущен
    if bot_manager.is_running(bot_id):
        await bot_manager.stop_bot(bot_id)
    
    db.delete(bot)
    db.commit()
    return None


@router.post("/{bot_id}/start", status_code=status.HTTP_200_OK)
async def start_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Запустить бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    if bot_manager.is_running(bot_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot is already running"
        )
    
    success = await bot_manager.start_bot(bot_id, bot.token, setup_bot_handlers)
    
    if success:
        bot.is_active = True
        db.commit()
        return {"message": "Bot started successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start bot"
        )


@router.post("/{bot_id}/stop", status_code=status.HTTP_200_OK)
async def stop_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Остановить бота"""
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    if not bot_manager.is_running(bot_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot is not running"
        )
    
    success = await bot_manager.stop_bot(bot_id)
    
    if success:
        bot.is_active = False
        db.commit()
        return {"message": "Bot stopped successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop bot"
        )


@router.get("/{bot_id}/users", response_model=List[TelegramUserResponse])
async def get_bot_users(
    bot_id: int,
    status_filter: Optional[str] = Query(None, description="Фильтр по статусу (active, blocked, left)"),
    source_filter: Optional[str] = Query(None, description="Фильтр по источнику"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список пользователей бота"""
    # Проверяем, что бот принадлежит пользователю
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Запрос пользователей
    query = db.query(TelegramUser).filter(TelegramUser.bot_id == bot_id)
    
    if status_filter:
        query = query.filter(TelegramUser.status == status_filter)
    
    if source_filter:
        query = query.filter(TelegramUser.source == source_filter)
    
    users = query.order_by(TelegramUser.joined_at.desc()).offset(skip).limit(limit).all()
    return users


@router.post("/{bot_id}/users/{user_id}/block", response_model=TelegramUserResponse, status_code=status.HTTP_200_OK)
async def block_user(
    bot_id: int,
    user_id: int,
    block_data: BlockUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать или разблокировать пользователя"""
    # Проверяем, что бот принадлежит пользователю
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Проверяем, что пользователь принадлежит этому боту
    user = db.query(TelegramUser).filter(
        TelegramUser.id == user_id,
        TelegramUser.bot_id == bot_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Обновляем статус
    old_status = user.status
    if block_data.blocked:
        user.status = "blocked"
    else:
        user.status = "active"
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"User {user.telegram_user_id} status changed from {old_status} to {user.status} by user {current_user.id}")
    
    return TelegramUserResponse.model_validate(user)


@router.post("/validate-token")
async def validate_token_endpoint(
    token_data: TokenValidateRequest,
    current_user: User = Depends(get_current_user)
):
    """Валидировать токен бота и получить информацию о нем"""
    bot_info = await validate_telegram_token(token_data.token)
    if not bot_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Telegram bot token"
        )
    
    return {
        "username": bot_info.get("username"),
        "first_name": bot_info.get("first_name"),
    }


@router.post("/{bot_id}/users/{user_id}/send-message", status_code=status.HTTP_200_OK)
async def send_message_to_user(
    bot_id: int,
    user_id: int,
    message_text: str = Form(...),
    media_type: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отправить личное сообщение пользователю с возможностью отправки медиа"""
    from aiogram.types import FSInputFile
    import uuid
    
    # Валидация message_text
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
    bot = db.query(Bot).filter(Bot.id == bot_id, Bot.owner_id == current_user.id).first()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Проверяем, что пользователь принадлежит этому боту
    user = db.query(TelegramUser).filter(
        TelegramUser.id == user_id,
        TelegramUser.bot_id == bot_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Проверяем, что пользователь не заблокирован
    if user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to blocked user"
        )
    
    # Пытаемся получить бота из менеджера или создаем новый экземпляр
    bot_instance = bot_manager.get_bot(bot_id)
    if not bot_instance:
        # Если бот не запущен, создаем временный экземпляр
        from aiogram.client.session.aiohttp import AiohttpSession
        session = AiohttpSession()
        bot_instance = AiogramBot(token=bot.token, session=session)
        should_close = True
    else:
        should_close = False
    
    # Создаем временную папку для медиа файлов
    MEDIA_TEMP_DIR = Path("/app/media/temp")
    MEDIA_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_file_path = None
    
    try:
        # Обрабатываем медиа файл, если он есть
        if media_file and media_file.filename:
            # Определяем тип медиа автоматически, если не указан
            if not media_type:
                file_ext = Path(media_file.filename).suffix.lower()
                if file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    final_media_type = 'photo'
                elif file_ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
                    final_media_type = 'video'
                elif file_ext in ['.mp3', '.wav', '.ogg', '.m4a']:
                    final_media_type = 'audio'
                else:
                    final_media_type = 'document'
            else:
                final_media_type = media_type
            
            # Сохраняем файл временно
            file_ext = Path(media_file.filename).suffix if media_file.filename else ""
            file_name = f"{uuid.uuid4()}{file_ext}"
            temp_file_path = MEDIA_TEMP_DIR / file_name
            
            with open(temp_file_path, "wb") as f:
                content = await media_file.read()
                f.write(content)
            
            # Отправляем медиа с подписью
            media_file_obj = FSInputFile(str(temp_file_path))
            if final_media_type == 'photo':
                await bot_instance.send_photo(
                    chat_id=user.telegram_user_id,
                    photo=media_file_obj,
                    caption=message_text
                )
            elif final_media_type == 'video':
                await bot_instance.send_video(
                    chat_id=user.telegram_user_id,
                    video=media_file_obj,
                    caption=message_text
                )
            elif final_media_type == 'audio':
                await bot_instance.send_audio(
                    chat_id=user.telegram_user_id,
                    audio=media_file_obj,
                    caption=message_text
                )
            elif final_media_type == 'document':
                await bot_instance.send_document(
                    chat_id=user.telegram_user_id,
                    document=media_file_obj,
                    caption=message_text
                )
            else:
                # Если тип неизвестен, отправляем как документ
                await bot_instance.send_document(
                    chat_id=user.telegram_user_id,
                    document=media_file_obj,
                    caption=message_text
                )
        else:
            # Отправляем только текст
            await bot_instance.send_message(
                chat_id=user.telegram_user_id,
                text=message_text
            )
        
        # Обновляем время последней активности
        user.last_activity = datetime.utcnow()
        db.commit()
        
        # Удаляем временный файл после успешной отправки
        if temp_file_path and temp_file_path.exists():
            try:
                temp_file_path.unlink()
                logger.info(f"Temporary media file deleted: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")
        
        return {"message": "Message sent successfully"}
        
    except TelegramForbiddenError:
        # Пользователь заблокировал бота
        user.status = "blocked"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has blocked the bot"
        )
    except TelegramBadRequest as e:
        logger.error(f"Error sending message to user {user.telegram_user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send message: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error sending message to user {user.telegram_user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
    finally:
        # Удаляем временный файл в случае ошибки
        if temp_file_path and temp_file_path.exists():
            try:
                temp_file_path.unlink()
                logger.info(f"Temporary media file deleted after error: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")
        
        if should_close:
            await bot_instance.session.close()

