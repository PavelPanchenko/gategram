from celery import Task
from celery.schedules import crontab
from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.broadcast import Broadcast, BroadcastStatus, BroadcastLog
from app.models.bot import Bot as BotModel
from app.models.telegram_user import TelegramUser
from app.utils.broadcast_filters import filter_users_for_broadcast
from aiogram import Bot
from aiogram.types import FSInputFile
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from pathlib import Path
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Rate limiting: максимум 30 сообщений в секунду (лимит Telegram)
BROADCAST_RATE_LIMIT = 30  # сообщений в секунду
BATCH_SIZE = 30  # размер батча для отправки

# Папка для медиа файлов (должна совпадать с backend/app/api/broadcasts.py)
MEDIA_DIR = Path("/app/media/broadcasts")

# Убеждаемся, что папка существует при импорте модуля
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
logger.info(f"Media directory initialized: {MEDIA_DIR}, exists: {MEDIA_DIR.exists()}")


@celery_app.task(bind=True, name="send_broadcast")
def send_broadcast_task(self: Task, broadcast_id: int):
    """Отправляет рассылку пользователям бота"""
    db = SessionLocal()
    try:
        broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
        if not broadcast:
            logger.error(f"Broadcast {broadcast_id} not found")
            return
        
        # Проверяем статус
        if broadcast.status not in [BroadcastStatus.PENDING.value, BroadcastStatus.SCHEDULED.value]:
            logger.warning(f"Broadcast {broadcast_id} has status {broadcast.status}, skipping")
            return
        
        # Проверяем, не отменена ли рассылка
        if broadcast.status == BroadcastStatus.CANCELLED.value:
            logger.info(f"Broadcast {broadcast_id} was cancelled")
            return
        
        # Если рассылка запланирована, проверяем, что время наступило
        if broadcast.status == BroadcastStatus.SCHEDULED.value and broadcast.scheduled_at:
            now = datetime.now(timezone.utc)  # UTC aware datetime
            # Убеждаемся, что scheduled_at тоже aware datetime в UTC
            scheduled_time = broadcast.scheduled_at
            if scheduled_time.tzinfo is None:
                # Если naive, считаем что это UTC
                scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
            else:
                # Если aware, конвертируем в UTC
                scheduled_time = scheduled_time.astimezone(timezone.utc)
            
            if scheduled_time > now:
                logger.info(f"Broadcast {broadcast_id} is scheduled for {scheduled_time}, current time is {now}, skipping")
                return
        
        # Обновляем статус на "отправка"
        broadcast.status = BroadcastStatus.SENDING.value
        broadcast.started_at = datetime.utcnow()
        db.commit()
        
        # Получаем бота
        bot_model = db.query(BotModel).filter(BotModel.id == broadcast.bot_id).first()
        if not bot_model:
            logger.error(f"Bot {broadcast.bot_id} not found")
            broadcast.status = BroadcastStatus.FAILED.value
            db.commit()
            return
        
        # Получаем список пользователей с применением фильтров
        # Примечание: всегда используются только активные пользователи (status='active'),
        # так как заблокированным пользователям отправить сообщение невозможно
        filters = broadcast.filters if broadcast.filters else {}
        
        users = filter_users_for_broadcast(
            db=db,
            bot_id=broadcast.bot_id,
            filters=filters
        )
        
        if not users:
            logger.warning(f"No active users for bot {broadcast.bot_id}")
            broadcast.status = BroadcastStatus.COMPLETED.value
            broadcast.completed_at = datetime.utcnow()
            broadcast.total_users = 0
            db.commit()
            return
        
        # Обновляем total_users на основе актуального количества пользователей
        # (может измениться, если пользователи заблокировали бота после создания рассылки)
        broadcast.total_users = len(users)
        db.commit()
        
        # Логируем информацию о рассылке
        logger.info(f"Starting broadcast {broadcast_id}: media_type={broadcast.media_type}, media_url={broadcast.media_url}, media_files={broadcast.media_files}, message_text length={len(broadcast.message_text)}")
        if broadcast.media_files:
            logger.info(f"Broadcast {broadcast_id} has {len(broadcast.media_files)} media files: {[f.get('type', 'unknown') for f in broadcast.media_files]}")
        
        # Запускаем асинхронную отправку
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _send_broadcast_async(broadcast, bot_model.token, users, db)
            )
            return result
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error sending broadcast {broadcast_id}: {e}", exc_info=True)
        db.rollback()
        broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
        if broadcast:
            broadcast.status = BroadcastStatus.FAILED.value
            
            # Удаляем медиа файл при ошибке
            if broadcast.media_url:
                try:
                    media_path = Path(broadcast.media_url)
                    possible_paths = [
                        media_path,
                        media_path.absolute(),
                        MEDIA_DIR / media_path.name,
                        MEDIA_DIR / Path(broadcast.media_url).name,
                    ]
                    
                    for path in possible_paths:
                        if path.exists() and path.is_file():
                            path.unlink()
                            logger.info(f"Deleted media file after broadcast failure: {path} (broadcast {broadcast.id})")
                            break
                    
                    # Очищаем media_url и media_type в БД
                    broadcast.media_url = None
                    broadcast.media_type = None
                except Exception as del_err:
                    logger.error(f"Error deleting media file after broadcast failure {broadcast.id}: {del_err}", exc_info=True)
            
            db.commit()
        raise
    finally:
        db.close()


async def _send_broadcast_async(
    broadcast: Broadcast,
    bot_token: str,
    users: List[TelegramUser],
    db: Session
):
    """Асинхронная отправка рассылки"""
    bot = Bot(token=bot_token)
    sent_count = 0
    failed_count = 0
    
    try:
        # Отправляем сообщения батчами с rate limiting
        for i in range(0, len(users), BATCH_SIZE):
            batch = users[i:i + BATCH_SIZE]
            
            # Отправляем батч
            tasks = []
            for user in batch:
                task = _send_message_to_user(
                    bot, 
                    user,  # Передаем объект пользователя напрямую
                    broadcast.message_text, 
                    db, 
                    broadcast.id,
                    broadcast.media_type,
                    broadcast.media_url,
                    broadcast.template_id,
                    broadcast.media_files
                )
                tasks.append(task)
            
            # Ждем завершения батча
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Обрабатываем результаты
            for user, result in zip(batch, results):
                if isinstance(result, Exception):
                    failed_count += 1
                    logger.error(f"Failed to send to user {user.telegram_user_id}: {result}")
                elif result is True:
                    sent_count += 1
                else:
                    # result is False - пользователь заблокировал бота или другая ошибка
                    failed_count += 1
                    logger.warning(f"Failed to send to user {user.telegram_user_id}: message not delivered")
            
            # Обновляем счетчики в БД
            broadcast.sent_count = sent_count
            broadcast.failed_count = failed_count
            db.commit()
            
            # Rate limiting: ждем 1 секунду между батчами
            if i + BATCH_SIZE < len(users):
                await asyncio.sleep(1)
        
        # Завершаем рассылку
        broadcast.status = BroadcastStatus.COMPLETED.value
        broadcast.completed_at = datetime.utcnow()
        
        # Удаляем медиа файл после завершения рассылки
        if broadcast.media_url:
            try:
                media_path = Path(broadcast.media_url)
                possible_paths = [
                    media_path,
                    media_path.absolute(),
                    MEDIA_DIR / media_path.name,
                    MEDIA_DIR / Path(broadcast.media_url).name,
                ]
                
                deleted = False
                for path in possible_paths:
                    if path.exists() and path.is_file():
                        path.unlink()
                        logger.info(f"Deleted media file after broadcast completion: {path} (broadcast {broadcast.id})")
                        deleted = True
                        break
                
                if not deleted:
                    logger.warning(f"Media file not found for deletion after broadcast {broadcast.id}: {broadcast.media_url}")
                
                # Очищаем media_url и media_type в БД
                broadcast.media_url = None
                broadcast.media_type = None
                
            except Exception as e:
                logger.error(f"Error deleting media file after broadcast {broadcast.id}: {e}", exc_info=True)
                # Не прерываем выполнение, если не удалось удалить файл
        
        db.commit()
        
        logger.info(f"Broadcast {broadcast.id} completed: {sent_count} sent, {failed_count} failed")
        
    finally:
        await bot.session.close()


async def _send_message_to_user(
    bot: Bot,
    user: TelegramUser,
    message_text: str,
    db: Session,
    broadcast_id: int,
    media_type: str = None,
    media_url: str = None,
    template_id: int = None,
    media_files: List[Dict[str, str]] = None
) -> bool:
    """Отправляет сообщение одному пользователю"""
    try:
        telegram_user_id = user.telegram_user_id
        
        # Обновляем объект пользователя из БД, чтобы получить актуальные данные
        db.refresh(user)
        
        # Обрабатываем переменные в сообщении
        from app.utils.template_processor import process_template
        
        # Если используется шаблон, используем его содержимое
        if template_id:
            from app.models.message_template import MessageTemplate
            template = db.query(MessageTemplate).filter(
                MessageTemplate.id == template_id
            ).first()
            if template:
                # Используем содержимое шаблона и обрабатываем переменные
                final_message_text = process_template(template.content, user, {})
            else:
                # Шаблон не найден, используем message_text и обрабатываем переменные
                logger.warning(f"Template {template_id} not found for user {telegram_user_id}")
                final_message_text = process_template(message_text, user, {})
        else:
            # Шаблон не используется, обрабатываем переменные в message_text
            final_message_text = process_template(message_text, user, {})
        
        # Обновляем last_activity пользователя
        if user:
            user.last_activity = datetime.utcnow()
            db.commit()
        
        # Финальная проверка перед отправкой
        if '{{' in final_message_text:
            logger.warning(f"Variables not processed for user {telegram_user_id}")
        
        # Отправляем медиа-группу, если есть несколько файлов
        if media_files and len(media_files) > 0:
            from aiogram.types import InputMediaPhoto, InputMediaVideo, InputMediaDocument, InputMediaAudio
            
            try:
                media_group = []
                for idx, media_item in enumerate(media_files[:10]):  # Максимум 10 файлов в группе
                    media_type_item = media_item.get("type", "document")
                    media_url_item = media_item.get("url")
                    
                    if not media_url_item:
                        continue
                    
                    # Находим файл
                    media_path = None
                    possible_paths = [
                        Path(media_url_item),
                        Path(media_url_item).absolute(),
                        MEDIA_DIR / Path(media_url_item).name,
                    ]
                    
                    if not Path(media_url_item).is_absolute():
                        possible_paths.append(MEDIA_DIR / media_url_item)
                    
                    for path in possible_paths:
                        if path.exists() and path.is_file():
                            media_path = path
                            break
                    
                    if not media_path or not media_path.exists():
                        logger.warning(f"Media file not found: {media_url_item}, skipping")
                        continue
                    
                    media_file = FSInputFile(str(media_path))
                    caption = final_message_text if idx == 0 else None  # Подпись только к первому файлу
                    
                    if media_type_item == "photo":
                        media_group.append(InputMediaPhoto(media=media_file, caption=caption))
                    elif media_type_item == "video":
                        media_group.append(InputMediaVideo(media=media_file, caption=caption))
                    elif media_type_item == "audio":
                        media_group.append(InputMediaAudio(media=media_file, caption=caption))
                    else:
                        media_group.append(InputMediaDocument(media=media_file, caption=caption))
                
                if len(media_group) > 0:
                    if len(media_group) == 1:
                        # Если один файл, отправляем обычным способом
                        media_item = media_group[0]
                        if isinstance(media_item, InputMediaPhoto):
                            await bot.send_photo(chat_id=telegram_user_id, photo=media_item.media, caption=media_item.caption)
                        elif isinstance(media_item, InputMediaVideo):
                            await bot.send_video(chat_id=telegram_user_id, video=media_item.media, caption=media_item.caption)
                        elif isinstance(media_item, InputMediaAudio):
                            await bot.send_audio(chat_id=telegram_user_id, audio=media_item.media, caption=media_item.caption)
                        else:
                            await bot.send_document(chat_id=telegram_user_id, document=media_item.media, caption=media_item.caption)
                    else:
                        # Отправляем медиа-группу
                        await bot.send_media_group(chat_id=telegram_user_id, media=media_group)
                    logger.info(f"Successfully sent media group ({len(media_group)} files) to user {telegram_user_id}")
                else:
                    # Если не удалось загрузить файлы, отправляем только текст
                    await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
                    logger.warning(f"No valid media files found, sent text only to user {telegram_user_id}")
            except Exception as e:
                logger.error(f"Error sending media group to user {telegram_user_id}: {e}", exc_info=True)
                # Fallback: отправляем только текст
                await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
                raise
        
        # Отправляем одиночное медиа (для обратной совместимости)
        elif media_type and media_url:
            # Проверяем, является ли media_url путем к файлу или URL
            # Пробуем разные варианты пути
            media_path = None
            possible_paths = [
                Path(media_url),  # Оригинальный путь
                Path(media_url).absolute(),  # Абсолютный путь
                MEDIA_DIR / Path(media_url).name,  # Имя файла в MEDIA_DIR
            ]
            
            # Если путь относительный, пробуем относительно MEDIA_DIR
            if not Path(media_url).is_absolute():
                possible_paths.append(MEDIA_DIR / media_url)
            
            # Логируем для отладки
            logger.info(f"Trying to send media to user {telegram_user_id}: type={media_type}, url={media_url}")
            logger.info(f"MEDIA_DIR: {MEDIA_DIR}, exists: {MEDIA_DIR.exists()}")
            logger.info(f"Checking possible paths:")
            for i, path in enumerate(possible_paths):
                exists = path.exists()
                is_file = path.is_file() if exists else False
                logger.info(f"  Path {i+1}: {path} - exists: {exists}, is_file: {is_file}")
            
            # Ищем существующий файл
            for path in possible_paths:
                if path.exists() and path.is_file():
                    media_path = path
                    logger.info(f"Found media file at: {media_path}")
                    break
            
            if media_path and media_path.exists() and media_path.is_file():
                # Это локальный файл
                file_size = media_path.stat().st_size
                logger.info(f"Sending local file: {media_path}, size: {file_size} bytes, type: {media_type}")
                media_file = FSInputFile(str(media_path))
                
                try:
                    if media_type == "photo":
                        await bot.send_photo(chat_id=telegram_user_id, photo=media_file, caption=final_message_text)
                        logger.info(f"Successfully sent photo to user {telegram_user_id}")
                    elif media_type == "video":
                        await bot.send_video(chat_id=telegram_user_id, video=media_file, caption=final_message_text)
                        logger.info(f"Successfully sent video to user {telegram_user_id}")
                    elif media_type == "document":
                        await bot.send_document(chat_id=telegram_user_id, document=media_file, caption=final_message_text)
                        logger.info(f"Successfully sent document to user {telegram_user_id}")
                    elif media_type == "audio":
                        await bot.send_audio(chat_id=telegram_user_id, audio=media_file, caption=final_message_text)
                        logger.info(f"Successfully sent audio to user {telegram_user_id}")
                    else:
                        logger.warning(f"Unknown media type: {media_type}, sending text only")
                        await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
                except Exception as e:
                    logger.error(f"Error sending media to user {telegram_user_id}: {e}", exc_info=True)
                    raise
            else:
                # Это URL или file_id, или файл не найден
                logger.warning(f"Media file not found! Original URL: {media_url}")
                logger.warning(f"Checked paths: {[str(p) for p in possible_paths]}")
                logger.warning(f"MEDIA_DIR contents: {list(MEDIA_DIR.iterdir()) if MEDIA_DIR.exists() else 'MEDIA_DIR does not exist'}")
                logger.warning(f"Trying as URL/file_id or sending text only")
                
                # Пробуем отправить как URL/file_id
                try:
                    if media_type == "photo":
                        await bot.send_photo(chat_id=telegram_user_id, photo=media_url, caption=final_message_text)
                    elif media_type == "video":
                        await bot.send_video(chat_id=telegram_user_id, video=media_url, caption=final_message_text)
                    elif media_type == "document":
                        await bot.send_document(chat_id=telegram_user_id, document=media_url, caption=final_message_text)
                    elif media_type == "audio":
                        await bot.send_audio(chat_id=telegram_user_id, audio=media_url, caption=final_message_text)
                    else:
                        logger.warning(f"Unknown media type: {media_type}, sending text only")
                        await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
                except Exception as e:
                    logger.error(f"Error sending media as URL/file_id to user {telegram_user_id}: {e}", exc_info=True)
                    # Fallback: отправляем только текст
                    logger.warning(f"Falling back to text-only message for user {telegram_user_id}")
                    await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
        else:
            # Нет медиа, отправляем только текст
            logger.info(f"No media, sending text only to user {telegram_user_id}. media_type={media_type}, media_url={media_url}")
            await bot.send_message(chat_id=telegram_user_id, text=final_message_text)
        
        # Логируем успешную отправку
        log = BroadcastLog(
            broadcast_id=broadcast_id,
            telegram_user_id=telegram_user_id,
            success=True
        )
        db.add(log)
        db.commit()
        
        return True
        
    except TelegramForbiddenError:
        # Пользователь заблокировал бота
        log = BroadcastLog(
            broadcast_id=broadcast_id,
            telegram_user_id=telegram_user_id,
            success=False,
            error_message="User blocked the bot"
        )
        db.add(log)
        # Обновляем статус пользователя
        user = db.query(TelegramUser).filter(
            TelegramUser.telegram_user_id == telegram_user_id
        ).first()
        if user:
            user.status = "blocked"
        db.commit()
        return False
        
    except TelegramBadRequest as e:
        # Другая ошибка
        log = BroadcastLog(
            broadcast_id=broadcast_id,
            telegram_user_id=telegram_user_id,
            success=False,
            error_message=str(e)
        )
        db.add(log)
        db.commit()
        return False
        
    except Exception as e:
        logger.error(f"Unexpected error sending to user {telegram_user_id}: {e}")
        log = BroadcastLog(
            broadcast_id=broadcast_id,
            telegram_user_id=telegram_user_id,
            success=False,
            error_message=str(e)
        )
        db.add(log)
        db.commit()
        return False


@celery_app.task(name="check_scheduled_broadcasts")
def check_scheduled_broadcasts_task():
    """Проверяет запланированные рассылки и запускает те, время которых наступило"""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)  # UTC aware datetime
        
        # Находим все запланированные рассылки, время которых наступило
        # SQLAlchemy автоматически обработает сравнение aware datetime с timezone=True колонкой
        scheduled_broadcasts = db.query(Broadcast).filter(
            Broadcast.status == BroadcastStatus.SCHEDULED.value,
            Broadcast.scheduled_at.isnot(None),
            Broadcast.scheduled_at <= now
        ).all()
        
        logger.info(f"Found {len(scheduled_broadcasts)} scheduled broadcasts ready to send")
        
        for broadcast in scheduled_broadcasts:
            try:
                logger.info(f"Starting scheduled broadcast {broadcast.id} (scheduled for {broadcast.scheduled_at})")
                # Запускаем задачу отправки
                send_broadcast_task.delay(broadcast.id)
            except Exception as e:
                logger.error(f"Error starting scheduled broadcast {broadcast.id}: {e}", exc_info=True)
                # Помечаем рассылку как failed
                broadcast.status = BroadcastStatus.FAILED.value
                db.commit()
        
        return {
            "checked": len(scheduled_broadcasts),
            "started": len(scheduled_broadcasts)
        }
        
    except Exception as e:
        logger.error(f"Error in check_scheduled_broadcasts_task: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="cleanup_old_media_files")
def cleanup_old_media_files_task(days_old: int = 30):
    """Очищает медиа файлы рассылок старше указанного количества дней"""
    db = SessionLocal()
    try:
        # Находим все завершенные рассылки старше указанного количества дней
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        
        old_broadcasts = db.query(Broadcast).filter(
            Broadcast.completed_at < cutoff_date,
            Broadcast.media_url.isnot(None)
        ).all()
        
        deleted_count = 0
        failed_count = 0
        
        for broadcast in old_broadcasts:
            if broadcast.media_url:
                try:
                    media_path = Path(broadcast.media_url)
                    possible_paths = [
                        media_path,
                        media_path.absolute(),
                        MEDIA_DIR / media_path.name,
                        MEDIA_DIR / Path(broadcast.media_url).name,
                    ]
                    
                    deleted = False
                    for path in possible_paths:
                        if path.exists() and path.is_file():
                            path.unlink()
                            logger.info(f"Deleted old media file: {path} (broadcast {broadcast.id})")
                            deleted = True
                            deleted_count += 1
                            break
                    
                    if not deleted:
                        logger.warning(f"Media file not found for broadcast {broadcast.id}: {broadcast.media_url}")
                    
                    # Очищаем media_url в БД
                    broadcast.media_url = None
                    broadcast.media_type = None
                    
                except Exception as e:
                    logger.error(f"Error deleting media file for broadcast {broadcast.id}: {e}", exc_info=True)
                    failed_count += 1
        
        db.commit()
        logger.info(f"Cleanup completed: {deleted_count} files deleted, {failed_count} failed")
        
        return {
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "total_processed": len(old_broadcasts)
        }
        
    except Exception as e:
        logger.error(f"Error in cleanup_old_media_files_task: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

