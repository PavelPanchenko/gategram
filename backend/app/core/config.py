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
        """Строим DATABASE_URL из компонентов, если он не указан напрямую или пустой"""
        # Если DATABASE_URL пустой или не указан, строим из компонентов
        if not self.DATABASE_URL or self.DATABASE_URL.strip() == '':
            # Используем значения из переменных окружения или значения по умолчанию
            user = self.POSTGRES_USER or "gategram"
            password = self.POSTGRES_PASSWORD or "gategram"
            db = self.POSTGRES_DB or "gategram"
            self.DATABASE_URL = f"postgresql://{user}:{password}@postgres:5432/{db}"
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

