from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import List, Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "GateGram"
    DEBUG: bool = False
    
    # Database - все значения должны быть в backend/.env
    DATABASE_URL: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    
    # Redis - значение должно быть в backend/.env
    REDIS_URL: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_config(self):
        """Валидация и построение DATABASE_URL и REDIS_URL"""
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Логируем все значения для отладки
        logger.info(f"[Config] POSTGRES_USER from env: {self.POSTGRES_USER}")
        logger.info(f"[Config] POSTGRES_PASSWORD from env: {'***' if self.POSTGRES_PASSWORD else 'None'}")
        logger.info(f"[Config] POSTGRES_DB from env: {self.POSTGRES_DB}")
        logger.info(f"[Config] DATABASE_URL from env: {'***' if self.DATABASE_URL and '@' in self.DATABASE_URL else self.DATABASE_URL}")
        logger.info(f"[Config] REDIS_URL from env: {self.REDIS_URL}")
        
        # Валидация и построение DATABASE_URL
        # Приоритет: 1) DATABASE_URL, 2) POSTGRES_USER/PASSWORD/DB компоненты
        if self.DATABASE_URL and self.DATABASE_URL.strip():
            # DATABASE_URL указан напрямую, используем его
            masked_url = self.DATABASE_URL
            if '@' in masked_url:
                parts = masked_url.split('@')
                if ':' in parts[0]:
                    user_pass = parts[0].split('://')[1] if '://' in parts[0] else parts[0]
                    if ':' in user_pass:
                        user = user_pass.split(':')[0]
                        masked_url = masked_url.replace(f'{user}:', f'{user}:***', 1)
            logger.info(f"[Config] Using DATABASE_URL from env: {masked_url}")
        elif self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_DB:
            # Строим DATABASE_URL из компонентов
            user = self.POSTGRES_USER
            password = self.POSTGRES_PASSWORD
            db = self.POSTGRES_DB
            self.DATABASE_URL = f"postgresql://{user}:{password}@postgres:5432/{db}"
            logger.info(f"[Config] Built DATABASE_URL from components: postgresql://{user}:***@postgres:5432/{db}")
        else:
            # Ни DATABASE_URL, ни компоненты не указаны - ошибка конфигурации
            logger.error("[Config] ERROR: DATABASE_URL or POSTGRES_USER/PASSWORD/DB must be set in backend/.env")
            raise ValueError("DATABASE_URL or POSTGRES_USER/PASSWORD/DB must be set in backend/.env")
        
        # Валидация REDIS_URL
        if not self.REDIS_URL:
            logger.error("[Config] ERROR: REDIS_URL must be set in backend/.env")
            raise ValueError("REDIS_URL must be set in backend/.env")
        
        return self
    
    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def validate_database_url(cls, v) -> Optional[str]:
        """Если DATABASE_URL пустой, возвращаем None (будет построен в model_validator из компонентов)"""
        if not v or (isinstance(v, str) and v.strip() == ''):
            return None
        return str(v)
    
    @field_validator('REDIS_URL', mode='before')
    @classmethod
    def validate_redis_url(cls, v) -> Optional[str]:
        """REDIS_URL должен быть указан в backend/.env"""
        if not v or (isinstance(v, str) and v.strip() == ''):
            return None
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

# Логирование для отладки (всегда логируем, чтобы видеть что используется)
import logging
logger = logging.getLogger(__name__)

# Маскируем пароль в DATABASE_URL для логирования
masked_url = settings.DATABASE_URL
if '@' in masked_url:
    parts = masked_url.split('@')
    if ':' in parts[0]:
        user_pass = parts[0].split('://')[1] if '://' in parts[0] else parts[0]
        if ':' in user_pass:
            user = user_pass.split(':')[0]
            masked_url = masked_url.replace(f'{user}:', f'{user}:***', 1)
logger.info(f"[Config] Final DATABASE_URL: {masked_url}")
logger.info(f"[Config] POSTGRES_USER: {settings.POSTGRES_USER}")
logger.info(f"[Config] POSTGRES_PASSWORD (from env): {'***' if settings.POSTGRES_PASSWORD else 'None'}")
logger.info(f"[Config] POSTGRES_DB: {settings.POSTGRES_DB}")
