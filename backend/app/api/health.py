"""
Health check и мониторинг endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from pydantic import BaseModel
from datetime import datetime
import redis
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    redis: str
    version: str = "1.0.0"


@router.get("", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    Проверка здоровья приложения
    
    Проверяет:
    - Доступность API
    - Подключение к базе данных
    - Подключение к Redis
    """
    
    # Проверка базы данных
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Проверка Redis
    try:
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = f"error: {str(e)}"
    
    # Общий статус
    overall_status = "healthy" if db_status == "ok" and redis_status == "ok" else "unhealthy"
    
    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        database=db_status,
        redis=redis_status
    )


@router.get("/ping")
async def ping():
    """Простая проверка доступности"""
    return {"status": "ok", "message": "pong"}
