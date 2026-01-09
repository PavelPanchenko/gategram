"""Утилиты для обработки шаблонов сообщений"""
from typing import Dict, Any
from app.models.telegram_user import TelegramUser
import re


def process_template(template: str, user: TelegramUser, additional_data: Dict[str, Any] = None) -> str:
    """Обработать шаблон сообщения, заменив переменные на значения"""
    if additional_data is None:
        additional_data = {}
    
    # Базовые переменные пользователя
    variables = {
        "user_name": user.first_name or user.username or "Пользователь",
        "user_first_name": user.first_name or "",
        "user_last_name": user.last_name or "",
        "user_username": user.username or "",
        "user_id": str(user.telegram_user_id),
        "source": user.source or "unknown",
        "status": user.status,
    }
    
    # Добавляем дополнительные данные
    variables.update(additional_data)
    
    # Заменяем переменные в формате {{variable_name}}
    result = template
    for key, value in variables.items():
        pattern = r'\{\{' + re.escape(key) + r'\}\}'
        result = re.sub(pattern, str(value), result, flags=re.IGNORECASE)
    
    return result

