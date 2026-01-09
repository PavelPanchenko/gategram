from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "GateGram"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql://gategram:gategram@postgres:5432/gategram"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
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


settings = Settings()

