import httpx
from typing import Optional, Dict, Any
from app.core.config import settings


async def validate_telegram_token(token: str) -> Optional[Dict[str, Any]]:
    """Валидирует Telegram bot token и возвращает информацию о боте"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.TELEGRAM_API_URL}/bot{token}/getMe"
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    return data.get("result")
            return None
    except Exception:
        return None


async def get_bot_info(token: str) -> Optional[Dict[str, Any]]:
    """Получает информацию о боте по токену"""
    return await validate_telegram_token(token)


def normalize_channel_url(channel_input: str) -> str:
    """Нормализует ввод канала в полный URL"""
    if not channel_input:
        return channel_input
    
    channel_input = channel_input.strip()
    
    # Если уже полный URL, возвращаем как есть
    if channel_input.startswith(("https://t.me/", "http://t.me/", "https://", "http://")):
        return channel_input
    
    # Если формат @username, преобразуем в https://t.me/username
    if channel_input.startswith("@"):
        username = channel_input[1:]  # Убираем @
        return f"https://t.me/{username}"
    
    # Если просто username без @, добавляем префикс
    if channel_input and not channel_input.startswith(("http", "@")):
        return f"https://t.me/{channel_input}"
    
    return channel_input


async def get_channel_info(channel_url: str) -> Optional[str]:
    """Пытается получить название канала из URL или username"""
    try:
        if not channel_url:
            return None
        
        # Нормализуем URL
        normalized_url = normalize_channel_url(channel_url)
        
        # Если формат @username, извлекаем username
        if channel_url.startswith("@"):
            username = channel_url[1:].strip()
            if username:
                # Преобразуем в читаемое название
                readable_name = username.replace("_", " ").replace("-", " ")
                readable_name = " ".join(word.capitalize() for word in readable_name.split())
                return readable_name
        
        # Парсим URL канала Telegram
        # Формат: https://t.me/channel_name или https://t.me/joinchat/...
        if not normalized_url.startswith(("https://t.me/", "http://t.me/")):
            return None
        
        # Извлекаем имя канала из URL
        parts = normalized_url.replace("https://t.me/", "").replace("http://t.me/", "").split("/")
        if parts:
            channel_name = parts[0].strip()
            # Убираем параметры запроса
            if "?" in channel_name:
                channel_name = channel_name.split("?")[0]
            if channel_name and channel_name != "joinchat":
                # Преобразуем в читаемое название (убираем подчеркивания, делаем заглавной первую букву)
                readable_name = channel_name.replace("_", " ").replace("-", " ")
                readable_name = " ".join(word.capitalize() for word in readable_name.split())
                return readable_name
    except Exception:
        pass
    return None

