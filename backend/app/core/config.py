from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import List, Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "GateGram"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql://gategram:gategram@postgres:5432/gategram"
    # Переменные для docker-compose (могут быть не использованы в коде, но должны быть в Settings)
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    @model_validator(mode='after')
    def build_database_url(self):
        """Строим DATABASE_URL из компонентов, если они указаны, или используем значение по умолчанию"""
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Если указаны компоненты POSTGRES_*, используем их для построения DATABASE_URL
        # Это позволяет переопределить пароль через переменные окружения
        if self.POSTGRES_USER or self.POSTGRES_PASSWORD or self.POSTGRES_DB:
            user = self.POSTGRES_USER or "gategram"
            password = self.POSTGRES_PASSWORD or "gategram"
            db = self.POSTGRES_DB or "gategram"
            self.DATABASE_URL = f"postgresql://{user}:{password}@postgres:5432/{db}"
            logger.info(f"Built DATABASE_URL from components: postgresql://{user}:***@postgres:5432/{db}")
        elif not self.DATABASE_URL or self.DATABASE_URL.strip() == '':
            # Если DATABASE_URL пустой и компоненты не указаны, используем значения по умолчанию
            self.DATABASE_URL = "postgresql://gategram:gategram@postgres:5432/gategram"
            logger.info("Using default DATABASE_URL")
        else:
            # DATABASE_URL указан напрямую, используем его
            logger.info(f"Using DATABASE_URL from config (masked)")
        
        return self
    
    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def validate_database_url(cls, v) -> str:
        """Если DATABASE_URL пустой, возвращаем пустую строку (будет построен в model_validator)"""
        if not v or (isinstance(v, str) and v.strip() == ''):
            return ""
        return str(v)
    
    @field_validator('REDIS_URL', mode='before')
    @classmethod
    def validate_redis_url(cls, v) -> str:
        """Если REDIS_URL пустой, используем значение по умолчанию"""
        if not v or (isinstance(v, str) and v.strip() == ''):
            return "redis://redis:6379/0"
        return str(v)
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS - храним как строку, парсим через property
    # Это позволяет избежать проблем с автоматическим JSON парсингом в Pydantic Settings
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Возвращает список CORS origins, парсит строку через запятую"""
        return [
            origin.strip() 
            for origin in self.CORS_ORIGINS.split(",") 
            if origin.strip()
        ]
    
    # Telegram
    TELEGRAM_API_URL: str = "https://api.telegram.org"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        # Разрешаем дополнительные поля из .env (для переменных docker-compose)
        extra = "ignore"


settings = Settings()

# Логирование для отладки (только в dev режиме)
import logging
logger = logging.getLogger(__name__)
if settings.DEBUG:
    # Маскируем пароль в DATABASE_URL для логирования
    masked_url = settings.DATABASE_URL
    if '@' in masked_url:
        parts = masked_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split('://')[1] if '://' in parts[0] else parts[0]
            if ':' in user_pass:
                user = user_pass.split(':')[0]
                masked_url = masked_url.replace(f'{user}:', f'{user}:***', 1)
    logger.info(f"DATABASE_URL: {masked_url}")
    logger.info(f"POSTGRES_USER: {settings.POSTGRES_USER}")
    logger.info(f"POSTGRES_DB: {settings.POSTGRES_DB}")
