"""Утилиты для обработки шаблонов сообщений"""
from typing import Dict, Any
from app.models.telegram_user import TelegramUser
import re
import logging

logger = logging.getLogger(__name__)


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
        "status": user.status or "active",
    }
    
    # Добавляем дополнительные данные (они имеют приоритет над базовыми)
    variables.update(additional_data)
    
    logger.info(f"Processing template: '{template}', user: id={user.telegram_user_id}, first_name='{user.first_name}', username='{user.username}', variables: {variables}")
    
    # Заменяем переменные в формате {{variable_name}} (с учетом пробелов)
    result = template
    replaced_count = 0
    
    # Сначала находим все переменные в шаблоне
    all_vars_in_template = re.findall(r'\{\{\s*(\w+)\s*\}\}', template, flags=re.IGNORECASE)
    logger.info(f"Found variables in template: {all_vars_in_template}")
    
    for key, value in variables.items():
        # Паттерн для {{key}} с возможными пробелами: {{ key }}, {{key}}, {{ key}}
        # \s* означает ноль или более пробелов
        pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
        before = result
        matches = re.findall(pattern, result, flags=re.IGNORECASE)
        if matches:
            logger.info(f"Found {len(matches)} match(es) for variable '{key}' in template")
        result = re.sub(pattern, str(value), result, flags=re.IGNORECASE)
        if before != result:
            replaced_count += 1
            logger.info(f"Replaced {{{{ {key} }}}} with '{value}'")
    
    # Проверяем, остались ли необработанные переменные
    remaining_vars = re.findall(r'\{\{\s*(\w+)\s*\}\}', result, flags=re.IGNORECASE)
    if remaining_vars:
        logger.warning(f"Variables not replaced: {remaining_vars}. Available variables: {list(variables.keys())}")
    
    if replaced_count == 0 and '{{' in template:
        logger.warning(f"No variables were replaced in template. Template: '{template}', Available variables: {list(variables.keys())}, Found in template: {all_vars_in_template}")
    
    logger.info(f"Template processed result: '{result}' (replaced {replaced_count} variables)")
    return result

