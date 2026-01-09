from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ChatMemberUpdated
from aiogram.filters import CommandStart, Command
from aiogram.filters.chat_member_updated import ChatMemberUpdatedFilter, JOIN_TRANSITION, LEAVE_TRANSITION
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
import asyncio
import logging
from app.core.database import SessionLocal
from app.models.bot import Bot as BotModel
from app.models.telegram_user import TelegramUser, UserStatus
from app.models.message_template import MessageTemplate
from app.models.trigger import TriggerEvent
from app.services.trigger_processor import process_trigger_event
from app.utils.template_processor import process_template

logger = logging.getLogger(__name__)


class UserInteraction(StatesGroup):
    waiting_for_interaction = State()


# Глобальный словарь для отслеживания обрабатываемых команд /start
# Ключ: (bot_id, user_id), Значение: timestamp последней обработки
_processing_start_commands: Dict[Tuple[int, int], datetime] = {}
# Время жизни записи (секунды) - игнорируем повторные /start в течение этого времени
_START_COMMAND_COOLDOWN = 3  # секунды
# Флаг для отслеживания, запущена ли задача очистки
_cleanup_task_started = False


def setup_bot_handlers(router: Router, bot_id: int):
    """Настраивает обработчики для конкретного бота"""
    
    # Периодически очищаем старые записи из словаря обработки команд (только один раз)
    global _cleanup_task_started
    if not _cleanup_task_started:
        async def cleanup_old_commands():
            """Очищает старые записи из словаря обработки команд"""
            while True:
                try:
                    await asyncio.sleep(60)  # Проверяем каждую минуту
                    now = datetime.utcnow()
                    keys_to_remove = []
                    for key, timestamp in list(_processing_start_commands.items()):
                        if (now - timestamp).total_seconds() > _START_COMMAND_COOLDOWN * 2:
                            keys_to_remove.append(key)
                    for key in keys_to_remove:
                        _processing_start_commands.pop(key, None)
                    if keys_to_remove:
                        logger.debug(f"Cleaned up {len(keys_to_remove)} old command processing records")
                except Exception as e:
                    logger.error(f"Error in cleanup_old_commands: {e}")
        
        # Запускаем задачу очистки в фоне
        asyncio.create_task(cleanup_old_commands())
        _cleanup_task_started = True
    
    @router.message(CommandStart())
    async def cmd_start(message: Message, state: FSMContext):
        """Обработчик команды /start с защитой от дублирования"""
        user_id = message.from_user.id
        command_key = (bot_id, user_id)
        now = datetime.utcnow()
        
        # Проверяем антифлуд: если команда /start уже обрабатывалась недавно, игнорируем
        if command_key in _processing_start_commands:
            last_processed = _processing_start_commands[command_key]
            time_diff = (now - last_processed).total_seconds()
            if time_diff < _START_COMMAND_COOLDOWN:
                logger.debug(f"Ignoring duplicate /start from user {user_id} for bot {bot_id} (last processed {time_diff:.2f}s ago)")
                return  # Игнорируем повторный запрос
        
        # Помечаем, что обрабатываем этот запрос
        _processing_start_commands[command_key] = now
        
        db = SessionLocal()
        try:
            # Получаем бота из БД
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot:
                await message.answer("Бот не найден")
                return
            
            # Проверяем, что бот активен и запущен
            if not bot.is_active:
                await message.answer("Бот временно недоступен")
                return
            
            # Проверяем, что бот действительно запущен в менеджере
            from app.services.bot_manager import bot_manager
            if not bot_manager.is_running(bot_id):
                logger.warning(f"Bot {bot_id} is marked as active but not running. Attempting to start...")
                try:
                    from app.services.bot_handlers import setup_bot_handlers
                    success = await bot_manager.start_bot(bot_id, bot.token, setup_bot_handlers)
                    if not success:
                        await message.answer("Бот временно недоступен. Попробуйте позже.")
                        return
                except Exception as e:
                    logger.error(f"Failed to restart bot {bot_id}: {e}")
                    await message.answer("Бот временно недоступен. Попробуйте позже.")
                    return
            username = message.from_user.username
            first_name = message.from_user.first_name
            last_name = message.from_user.last_name
            
            # Извлекаем source из параметров команды /start
            source = None
            if message.text and len(message.text.split()) > 1:
                source = message.text.split()[1]
            
            # Проверяем, существует ли пользователь
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.bot_id == bot_id,
                TelegramUser.telegram_user_id == user_id
            ).first()
            
            is_new_user = False
            if not telegram_user:
                # Создаем нового пользователя
                is_new_user = True
                telegram_user = TelegramUser(
                    bot_id=bot_id,
                    telegram_user_id=user_id,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    source=source,
                    status=UserStatus.ACTIVE.value,
                    joined_at=datetime.utcnow(),
                    last_activity=datetime.utcnow()
                )
                db.add(telegram_user)
            else:
                # Обновляем информацию
                telegram_user.username = username
                telegram_user.first_name = first_name
                telegram_user.last_name = last_name
                if source and not telegram_user.source:
                    telegram_user.source = source
                telegram_user.last_activity = datetime.utcnow()
                # Если пользователь был заблокирован или имел статус "left", но снова пишет /start - активируем
                if telegram_user.status == UserStatus.BLOCKED.value:
                    telegram_user.status = UserStatus.ACTIVE.value
                    logger.info(f"Unblocked user {user_id} for bot {bot_id} (user sent /start)")
                elif telegram_user.status == UserStatus.LEFT.value:
                    telegram_user.status = UserStatus.ACTIVE.value
                    logger.info(f"Reactivated user {user_id} for bot {bot_id} (user sent /start, was marked as 'left')")
            
            db.commit()
            
            # Обрабатываем триггеры для нового пользователя
            if is_new_user:
                await process_trigger_event(
                    db=db,
                    event_type=TriggerEvent.USER_REGISTERED.value,
                    bot_id=bot_id,
                    telegram_user_id=user_id,
                    data={"source": source}
                )
            
            # Отправляем welcome message (всегда показываем приветствие)
            # Сначала проверяем, есть ли активный шаблон
            template = db.query(MessageTemplate).filter(
                MessageTemplate.bot_id == bot_id,
                MessageTemplate.is_active == True,
                MessageTemplate.name.ilike("%welcome%")
            ).first()
            
            if template:
                # Используем шаблон (приоритет)
                welcome_text = process_template(template.content, telegram_user, {"source": source or "unknown"})
            elif bot.welcome_message:
                # Обрабатываем переменные в обычном welcome_message
                welcome_text = process_template(bot.welcome_message, telegram_user, {"source": source or "unknown"})
            else:
                welcome_text = "Добро пожаловать!"
            
            # Получаем список каналов
            channels = bot.channels or []
            # Если есть старый channel_link, добавляем его в список для обратной совместимости
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            # Логика отображения кнопок
            if bot.required_interaction and channels:
                # Если требуется взаимодействие и есть каналы - показываем ТОЛЬКО кнопку "Продолжить"
                # Каналы будут показаны только после нажатия на кнопку
                continue_text = bot.continue_button_text or "✅ Продолжить"
                keyboard = InlineKeyboardMarkup(inline_keyboard=[[
                    InlineKeyboardButton(text=continue_text, callback_data="continue")
                ]])
                await message.answer(welcome_text, reply_markup=keyboard)
                await state.set_state(UserInteraction.waiting_for_interaction)
            elif channels:
                # Немедленный доступ к каналам (без кнопки "Продолжить")
                keyboard_buttons = []
                for channel in channels:
                    channel_name = channel.get('name', 'Канал')
                    channel_url = channel.get('url')
                    if channel_url:
                        keyboard_buttons.append([
                            InlineKeyboardButton(
                                text=f"📢 {channel_name}",
                                url=channel_url
                            )
                        ])
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                await message.answer(welcome_text, reply_markup=keyboard)
            else:
                # Просто приветствие без каналов
                await message.answer(welcome_text)
                
        except Exception as e:
            logger.error(f"Error in cmd_start for bot {bot_id}: {e}")
            await message.answer("Произошла ошибка. Попробуйте позже.")
        finally:
            db.close()
    
    @router.callback_query(F.data == "continue")
    async def process_continue(callback: CallbackQuery, state: FSMContext):
        """Обработчик кнопки 'Продолжить'"""
        db = SessionLocal()
        try:
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot:
                await callback.answer("Бот не найден", show_alert=True)
                return
            
            if not bot.is_active:
                await callback.answer("Бот временно недоступен", show_alert=True)
                return
            
            # Проверяем, что бот действительно запущен
            from app.services.bot_manager import bot_manager
            if not bot_manager.is_running(bot_id):
                logger.warning(f"Bot {bot_id} is marked as active but not running in callback")
                await callback.answer("Бот временно недоступен. Попробуйте позже.", show_alert=True)
                return
            
            # Обновляем активность пользователя
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.bot_id == bot_id,
                TelegramUser.telegram_user_id == callback.from_user.id
            ).first()
            
            if telegram_user:
                telegram_user.last_activity = datetime.utcnow()
                db.commit()
            
            # Удаляем сообщение с кнопкой "Продолжить"
            try:
                await callback.message.delete()
            except:
                pass
            
            # Если есть задержка, ждем
            if bot.interaction_delay_seconds > 0:
                await callback.answer("Обрабатываем запрос...", show_alert=False)
                await asyncio.sleep(bot.interaction_delay_seconds)
            else:
                await callback.answer()
            
            # Получаем список каналов
            channels = bot.channels or []
            # Если есть старый channel_link, добавляем его в список для обратной совместимости
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            # Отправляем НОВОЕ сообщение со ссылками на каналы
            if channels:
                keyboard_buttons = []
                for channel in channels:
                    channel_name = channel.get('name', 'Канал')
                    channel_url = channel.get('url')
                    if channel_url:
                        keyboard_buttons.append([
                            InlineKeyboardButton(
                                text=f"📢 {channel_name}",
                                url=channel_url
                            )
                        ])
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                await callback.message.answer(
                    "Отлично! Вот ссылки на наши каналы:",
                    reply_markup=keyboard
                )
            else:
                await callback.message.answer("Спасибо за взаимодействие!")
            
            await state.clear()
            
        except Exception as e:
            logger.error(f"Error in process_continue for bot {bot_id}: {e}", exc_info=True)
            await callback.answer("Произошла ошибка", show_alert=True)
        finally:
            db.close()
    
    @router.message(Command("channels", "каналы", "канал"))
    async def cmd_channels(message: Message):
        """Обработчик команды для показа каналов"""
        db = SessionLocal()
        try:
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot or not bot.is_active:
                return
            
            # Получаем список каналов
            channels = bot.channels or []
            # Если есть старый channel_link, добавляем его в список для обратной совместимости
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            if not channels:
                await message.answer("Каналы не настроены.")
                return
            
            # Создаем клавиатуру с каналами
            keyboard_buttons = []
            for channel in channels:
                channel_name = channel.get('name', 'Канал')
                channel_url = channel.get('url')
                if channel_url:
                    keyboard_buttons.append([
                        InlineKeyboardButton(
                            text=f"📢 {channel_name}",
                            url=channel_url
                        )
                    ])
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
            await message.answer("Выберите канал:", reply_markup=keyboard)
            
        except Exception as e:
            logger.error(f"Error in cmd_channels for bot {bot_id}: {e}")
        finally:
            db.close()
    
    @router.message()
    async def handle_message(message: Message, state: FSMContext):
        """Обработчик всех остальных сообщений - всегда отвечает приветствием с каналами"""
        db = SessionLocal()
        try:
            # Получаем бота из БД
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot or not bot.is_active:
                return
            
            user_id = message.from_user.id
            username = message.from_user.username
            first_name = message.from_user.first_name
            last_name = message.from_user.last_name
            
            # Проверяем, существует ли пользователь
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.bot_id == bot_id,
                TelegramUser.telegram_user_id == user_id
            ).first()
            
            is_new_user = False
            if not telegram_user:
                # Создаем нового пользователя, если его нет
                is_new_user = True
                telegram_user = TelegramUser(
                    bot_id=bot_id,
                    telegram_user_id=user_id,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    source=None,  # Для обычных сообщений source не известен
                    status=UserStatus.ACTIVE.value,
                    joined_at=datetime.utcnow(),
                    last_activity=datetime.utcnow()
                )
                db.add(telegram_user)
                logger.info(f"Created new user {user_id} for bot {bot_id} from message")
            else:
                is_new_user = False
                # Обновляем информацию и активность
                telegram_user.username = username
                telegram_user.first_name = first_name
                telegram_user.last_name = last_name
                telegram_user.last_activity = datetime.utcnow()
                # Если пользователь был заблокирован или имел статус "left", но снова пишет - активируем
                if telegram_user.status == UserStatus.BLOCKED.value:
                    telegram_user.status = UserStatus.ACTIVE.value
                    logger.info(f"Unblocked user {user_id} for bot {bot_id} (user sent message)")
                elif telegram_user.status == UserStatus.LEFT.value:
                    telegram_user.status = UserStatus.ACTIVE.value
                    logger.info(f"Reactivated user {user_id} for bot {bot_id} (user sent message, was marked as 'left')")
            
            db.commit()
            
            # Обрабатываем триггеры для нового пользователя
            if is_new_user:
                await process_trigger_event(
                    db=db,
                    event_type=TriggerEvent.USER_REGISTERED.value,
                    bot_id=bot_id,
                    telegram_user_id=user_id,
                    data={}
                )
            
            # Всегда отправляем приветственное сообщение
            # Сначала проверяем, есть ли активный шаблон
            template = db.query(MessageTemplate).filter(
                MessageTemplate.bot_id == bot_id,
                MessageTemplate.is_active == True,
                MessageTemplate.name.ilike("%welcome%")
            ).first()
            
            if template:
                # Используем шаблон (приоритет)
                welcome_text = process_template(template.content, telegram_user, {})
            elif bot.welcome_message:
                # Обрабатываем переменные в обычном welcome_message
                welcome_text = process_template(bot.welcome_message, telegram_user, {})
            else:
                welcome_text = "Добро пожаловать!"
            
            # Получаем список каналов
            channels = bot.channels or []
            # Если есть старый channel_link, добавляем его в список для обратной совместимости
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            # Логика отображения кнопок (такая же как в /start)
            if bot.required_interaction and channels:
                # Если требуется взаимодействие и есть каналы - показываем только кнопку "Продолжить"
                continue_text = bot.continue_button_text or "✅ Продолжить"
                keyboard = InlineKeyboardMarkup(inline_keyboard=[[
                    InlineKeyboardButton(text=continue_text, callback_data="continue")
                ]])
                await message.answer(welcome_text, reply_markup=keyboard)
                await state.set_state(UserInteraction.waiting_for_interaction)
            elif channels:
                # Немедленный доступ к каналам (без кнопки "Продолжить")
                keyboard_buttons = []
                for channel in channels:
                    channel_name = channel.get('name', 'Канал')
                    channel_url = channel.get('url')
                    if channel_url:
                        keyboard_buttons.append([
                            InlineKeyboardButton(
                                text=f"📢 {channel_name}",
                                url=channel_url
                            )
                        ])
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                await message.answer(welcome_text, reply_markup=keyboard)
            else:
                # Просто приветствие без каналов
                await message.answer(welcome_text)
            
        except Exception as e:
            logger.error(f"Error in handle_message for bot {bot_id}: {e}", exc_info=True)
        finally:
            db.close()
    
    @router.chat_member(ChatMemberUpdatedFilter(member_status_changed=JOIN_TRANSITION))
    async def handle_chat_member_joined(update: ChatMemberUpdated):
        """Обработчик события присоединения пользователя к каналу/группе"""
        db = SessionLocal()
        try:
            logger.info(f"Received ChatMemberUpdated JOIN event for bot {bot_id}")
            
            # Получаем бота из БД
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot or not bot.is_active:
                logger.debug(f"Bot {bot_id} not found or not active, ignoring chat_member event")
                return
            
            # Проверяем, что это событие для канала/группы, а не для бота
            chat = update.chat
            logger.info(f"Chat type: {chat.type}, Chat ID: {chat.id}, Chat username: {chat.username}, Chat title: {chat.title}")
            
            if chat.type not in ("channel", "group", "supergroup"):
                logger.debug(f"Chat type {chat.type} is not channel/group/supergroup, ignoring")
                return
            
            # Получаем информацию о пользователе
            user = update.new_chat_member.user
            if not user:
                logger.warning("No user in ChatMemberUpdated event")
                return
            
            user_id = user.id
            logger.info(f"User {user_id} ({user.username or user.first_name}) joined chat {chat.id}")
            
            # Проверяем, что канал принадлежит этому боту (есть в списке каналов)
            channels = bot.channels or []
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            logger.info(f"Bot {bot_id} has {len(channels)} channels configured: {channels}")
            
            # Получаем username канала
            channel_username = chat.username
            channel_id = str(chat.id)
            
            # Проверяем, что это один из каналов бота
            is_bot_channel = False
            matched_channel = None
            for channel in channels:
                channel_url = channel.get('url', '').strip()
                if not channel_url:
                    continue
                    
                logger.debug(f"Checking channel URL: {channel_url} against chat username: {channel_username}, chat ID: {channel_id}")
                
                # Нормализуем URL канала для сравнения
                from app.utils.telegram import normalize_channel_url
                normalized_channel_url = normalize_channel_url(channel_url).lower()
                
                # Проверяем по username
                if channel_username:
                    # Проверяем разные форматы: @username, https://t.me/username, t.me/username
                    username_variants = [
                        f"@{channel_username}",
                        f"https://t.me/{channel_username}",
                        f"http://t.me/{channel_username}",
                        f"t.me/{channel_username}",
                        channel_username
                    ]
                    
                    for variant in username_variants:
                        if variant.lower() in normalized_channel_url:
                            is_bot_channel = True
                            matched_channel = channel
                            logger.info(f"Matched channel by username: {channel_url} matches {channel_username} (variant: {variant})")
                            break
                    
                    if is_bot_channel:
                        break
                
                # Проверяем по ID (для приватных каналов)
                # ID канала может быть отрицательным числом, например -1001234567890
                # Также проверяем без минуса, так как в URL может быть просто число
                channel_id_variants = [channel_id, f"-{channel_id}"]
                for variant in channel_id_variants:
                    if variant in channel_url:
                        is_bot_channel = True
                        matched_channel = channel
                        logger.info(f"Matched channel by ID: {channel_url} matches {channel_id} (variant: {variant})")
                        break
                
                if is_bot_channel:
                    break
            
            if not is_bot_channel:
                logger.warning(f"Chat {chat.id} ({chat.title}) is not in bot's channel list. Ignoring event.")
                return
            
            logger.info(f"Confirmed: chat {chat.id} is one of bot's channels. Processing trigger...")
            
            # Получаем или создаем пользователя
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.bot_id == bot_id,
                TelegramUser.telegram_user_id == user_id
            ).first()
            
            if not telegram_user:
                # Создаем пользователя, если его нет
                telegram_user = TelegramUser(
                    bot_id=bot_id,
                    telegram_user_id=user_id,
                    username=user.username,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    source=None,
                    status=UserStatus.ACTIVE.value,
                    joined_at=datetime.utcnow(),
                    last_activity=datetime.utcnow()
                )
                db.add(telegram_user)
                db.commit()
                logger.info(f"Created new user {user_id} for bot {bot_id} from channel join")
            else:
                # Обновляем информацию
                telegram_user.username = user.username
                telegram_user.first_name = user.first_name
                telegram_user.last_name = user.last_name
                telegram_user.last_activity = datetime.utcnow()
                if telegram_user.status == UserStatus.BLOCKED.value:
                    telegram_user.status = UserStatus.ACTIVE.value
                db.commit()
            
            # Обрабатываем триггер присоединения к каналу
            await process_trigger_event(
                db=db,
                event_type=TriggerEvent.USER_JOINED_CHANNEL.value,
                bot_id=bot_id,
                telegram_user_id=user_id,
                data={
                    "channel_id": channel_id,
                    "channel_username": channel_username,
                    "channel_title": chat.title
                }
            )
            
            logger.info(f"User {user_id} joined channel {chat.title} for bot {bot_id}")
            
        except Exception as e:
            logger.error(f"Error in handle_chat_member_joined for bot {bot_id}: {e}", exc_info=True)
        finally:
            db.close()
    
    @router.chat_member(ChatMemberUpdatedFilter(member_status_changed=LEAVE_TRANSITION))
    async def handle_chat_member_left(update: ChatMemberUpdated):
        """Обработчик события отписки пользователя от канала/группы"""
        db = SessionLocal()
        try:
            # Получаем бота из БД
            bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
            if not bot or not bot.is_active:
                return
            
            # Проверяем, что это событие для канала/группы
            chat = update.chat
            if chat.type not in ("channel", "group", "supergroup"):
                return
            
            # Получаем информацию о пользователе
            user = update.new_chat_member.user
            if not user:
                return
            
            user_id = user.id
            
            # Проверяем, что канал принадлежит этому боту
            channels = bot.channels or []
            if bot.channel_link and not any(ch.get('url') == bot.channel_link for ch in channels):
                channels.append({"name": "Канал", "url": bot.channel_link})
            
            channel_username = chat.username
            channel_id = str(chat.id)
            
            # Проверяем, что это один из каналов бота
            is_bot_channel = False
            for channel in channels:
                channel_url = channel.get('url', '')
                if channel_username and (f"@{channel_username}" in channel_url or channel_username in channel_url):
                    is_bot_channel = True
                    break
                if channel_id in channel_url or f"-{channel_id}" in channel_url:
                    is_bot_channel = True
                    break
            
            if not is_bot_channel:
                return
            
            # Получаем пользователя
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.bot_id == bot_id,
                TelegramUser.telegram_user_id == user_id
            ).first()
            
            if telegram_user:
                # Обновляем только last_activity, НЕ меняем статус
                # Отписка от канала не означает, что пользователь покинул бота
                # Пользователь может отписаться от канала, но продолжать общаться с ботом
                telegram_user.last_activity = datetime.utcnow()
                db.commit()
            
            # Обрабатываем триггер отписки от канала
            await process_trigger_event(
                db=db,
                event_type=TriggerEvent.USER_LEFT_CHANNEL.value,
                bot_id=bot_id,
                telegram_user_id=user_id,
                data={
                    "channel_id": channel_id,
                    "channel_username": channel_username,
                    "channel_title": chat.title
                }
            )
            
            logger.info(f"User {user_id} left channel {chat.title} for bot {bot_id}")
            
        except Exception as e:
            logger.error(f"Error in handle_chat_member_left for bot {bot_id}: {e}", exc_info=True)
        finally:
            db.close()

