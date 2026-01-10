from typing import Dict, Optional
from aiogram import Bot, Dispatcher, Router
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.fsm.storage.memory import MemoryStorage
import asyncio
import logging

logger = logging.getLogger(__name__)


class BotManager:
    """Менеджер для управления жизненным циклом Telegram ботов"""
    
    def __init__(self):
        self._bots: Dict[int, Bot] = {}  # bot_id -> Bot instance
        self._dispatchers: Dict[int, Dispatcher] = {}  # bot_id -> Dispatcher
        self._tasks: Dict[int, asyncio.Task] = {}  # bot_id -> Task
    
    async def start_bot(self, bot_id: int, token: str, handlers_setup_func) -> bool:
        """Запускает бота с заданными обработчиками"""
        if bot_id in self._bots:
            logger.warning(f"Bot {bot_id} is already running")
            return False
        
        try:
            logger.info(f"Starting bot {bot_id} with token {token[:10]}...")
            # Создаем бота и диспетчер
            session = AiohttpSession()
            bot = Bot(token=token, session=session)
            storage = MemoryStorage()
            dp = Dispatcher(storage=storage)
            
            # Настраиваем обработчики через router
            router = Router()
            logger.info(f"Setting up handlers for bot {bot_id}")
            handlers_setup_func(router, bot_id)
            dp.include_router(router)
            logger.info(f"Handlers registered for bot {bot_id}")
            
            # Сохраняем
            self._bots[bot_id] = bot
            self._dispatchers[bot_id] = dp
            
            # Запускаем polling в фоне
            logger.info(f"Starting polling task for bot {bot_id}")
            task = asyncio.create_task(self._run_polling(bot_id, bot, dp))
            self._tasks[bot_id] = task
            
            logger.info(f"Bot {bot_id} started successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to start bot {bot_id}: {e}", exc_info=True)
            if bot_id in self._bots:
                await self.stop_bot(bot_id)
            return False
    
    async def stop_bot(self, bot_id: int) -> bool:
        """Останавливает бота"""
        if bot_id not in self._bots:
            logger.warning(f"Bot {bot_id} is not running")
            return False
        
        try:
            # Отменяем задачу
            if bot_id in self._tasks:
                task = self._tasks[bot_id]
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                del self._tasks[bot_id]
            
            # Закрываем бота
            bot = self._bots[bot_id]
            await bot.session.close()
            
            # Удаляем из словарей
            del self._bots[bot_id]
            if bot_id in self._dispatchers:
                del self._dispatchers[bot_id]
            
            logger.info(f"Bot {bot_id} stopped successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to stop bot {bot_id}: {e}")
            return False
    
    async def _run_polling(self, bot_id: int, bot: Bot, dp: Dispatcher):
        """Запускает polling для бота с обработкой ошибок и автоматическим переподключением"""
        max_retries = 5
        retry_delay = 5  # секунд
        
        while True:
            try:
                logger.info(f"Starting polling for bot {bot_id}")
                await dp.start_polling(
                    bot, 
                    allowed_updates=["message", "callback_query", "chat_member", "my_chat_member"],
                    handle_as_tasks=False
                )
                # Если polling завершился нормально (не из-за ошибки), выходим
                logger.info(f"Polling for bot {bot_id} stopped normally")
                break
            except asyncio.CancelledError:
                logger.info(f"Polling for bot {bot_id} cancelled")
                break
            except Exception as e:
                error_str = str(e)
                logger.error(f"Error in polling for bot {bot_id}: {e}", exc_info=True)
                
                # Проверяем, это ли SSL/сетевая ошибка
                is_network_error = any(keyword in error_str.lower() for keyword in [
                    'ssl', 'network', 'connection', 'timeout', 'refused', 
                    'record layer failure', 'clientoserror'
                ])
                
                if is_network_error and max_retries > 0:
                    max_retries -= 1
                    logger.warning(
                        f"Network/SSL error for bot {bot_id}. "
                        f"Retrying in {retry_delay} seconds... ({max_retries} retries left)"
                    )
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 60)  # Экспоненциальная задержка, макс 60 сек
                    continue
                else:
                    # Если это не сетевая ошибка или закончились попытки, останавливаем бота
                    logger.error(f"Stopping bot {bot_id} due to unrecoverable error")
                    if bot_id in self._bots:
                        await self.stop_bot(bot_id)
                    break
    
    def is_running(self, bot_id: int) -> bool:
        """Проверяет, запущен ли бот"""
        return bot_id in self._bots
    
    async def restart_bot(self, bot_id: int, token: str, handlers_setup_func) -> bool:
        """Перезапускает бота"""
        await self.stop_bot(bot_id)
        return await self.start_bot(bot_id, token, handlers_setup_func)
    
    async def stop_all(self):
        """Останавливает всех ботов"""
        bot_ids = list(self._bots.keys())
        for bot_id in bot_ids:
            await self.stop_bot(bot_id)
    
    def get_bot(self, bot_id: int) -> Optional[Bot]:
        """Получает экземпляр бота по ID"""
        return self._bots.get(bot_id)


# Глобальный экземпляр менеджера
bot_manager = BotManager()

