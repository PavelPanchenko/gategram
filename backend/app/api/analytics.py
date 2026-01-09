from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.bot import Bot
from app.models.telegram_user import TelegramUser
from app.models.broadcast import Broadcast
from app.utils.dependencies import get_current_user
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/analytics", tags=["analytics"])


class BotStatsResponse(BaseModel):
    bot_id: int
    bot_name: Optional[str]
    total_users: int
    active_users: int
    blocked_users: int
    users_by_source: dict
    users_today: int
    users_this_week: int
    users_this_month: int


class SourceStatsResponse(BaseModel):
    source: Optional[str]
    total_users: int
    active_users: int
    conversion_rate: float


class TimeSeriesDataPoint(BaseModel):
    date: str
    count: int


class AnalyticsResponse(BaseModel):
    total_bots: int
    total_users: int
    active_users: int
    total_broadcasts: int
    successful_broadcasts: int
    users_today: int
    users_this_week: int
    users_this_month: int
    users_by_day: List[TimeSeriesDataPoint]
    users_by_source: List[SourceStatsResponse]


@router.get("/overview", response_model=AnalyticsResponse)
async def get_analytics_overview(
    days: int = Query(30, ge=1, le=365, description="Количество дней для статистики"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить общую аналитику"""
    # Получаем все боты пользователя
    user_bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    bot_ids = [bot.id for bot in user_bots]
    
    if not bot_ids:
        return AnalyticsResponse(
            total_bots=0,
            total_users=0,
            active_users=0,
            total_broadcasts=0,
            successful_broadcasts=0,
            users_today=0,
            users_this_week=0,
            users_this_month=0,
            users_by_day=[],
            users_by_source=[]
        )
    
    # Общая статистика
    total_users = db.query(TelegramUser).filter(TelegramUser.bot_id.in_(bot_ids)).count()
    active_users = db.query(TelegramUser).filter(
        TelegramUser.bot_id.in_(bot_ids),
        TelegramUser.status == "active"
    ).count()
    
    total_broadcasts = db.query(Broadcast).filter(Broadcast.owner_id == current_user.id).count()
    successful_broadcasts = db.query(Broadcast).filter(
        Broadcast.owner_id == current_user.id,
        Broadcast.status == "completed"
    ).count()
    
    # Статистика по времени
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    users_today = db.query(TelegramUser).filter(
        TelegramUser.bot_id.in_(bot_ids),
        TelegramUser.joined_at >= today_start
    ).count()
    
    users_this_week = db.query(TelegramUser).filter(
        TelegramUser.bot_id.in_(bot_ids),
        TelegramUser.joined_at >= week_start
    ).count()
    
    users_this_month = db.query(TelegramUser).filter(
        TelegramUser.bot_id.in_(bot_ids),
        TelegramUser.joined_at >= month_start
    ).count()
    
    # Статистика по дням
    start_date = now - timedelta(days=days)
    users_by_day_query = db.query(
        func.date(TelegramUser.joined_at).label('date'),
        func.count(TelegramUser.id).label('count')
    ).filter(
        TelegramUser.bot_id.in_(bot_ids),
        TelegramUser.joined_at >= start_date
    ).group_by(func.date(TelegramUser.joined_at)).order_by('date').all()
    
    users_by_day = [
        TimeSeriesDataPoint(date=row.date.isoformat(), count=row.count)
        for row in users_by_day_query
    ]
    
    # Статистика по источникам
    source_stats_query = db.query(
        TelegramUser.source,
        func.count(TelegramUser.id).label('total')
    ).filter(
        TelegramUser.bot_id.in_(bot_ids)
    ).group_by(TelegramUser.source).all()
    
    # Отдельно считаем активных пользователей по источникам
    active_by_source = {}
    for row in source_stats_query:
        source = row.source or "unknown"
        active_count = db.query(TelegramUser).filter(
            TelegramUser.bot_id.in_(bot_ids),
            TelegramUser.source == row.source,
            TelegramUser.status == "active"
        ).count()
        active_by_source[source] = active_count
    
    users_by_source = [
        SourceStatsResponse(
            source=row.source or "unknown",
            total_users=row.total,
            active_users=active_by_source.get(row.source or "unknown", 0),
            conversion_rate=active_by_source.get(row.source or "unknown", 0) / row.total * 100 if row.total > 0 else 0
        )
        for row in source_stats_query
    ]
    
    return AnalyticsResponse(
        total_bots=len(user_bots),
        total_users=total_users,
        active_users=active_users,
        total_broadcasts=total_broadcasts,
        successful_broadcasts=successful_broadcasts,
        users_today=users_today,
        users_this_week=users_this_week,
        users_this_month=users_this_month,
        users_by_day=users_by_day,
        users_by_source=users_by_source
    )


@router.get("/bots/{bot_id}/stats", response_model=BotStatsResponse)
async def get_bot_stats(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по конкретному боту"""
    bot = db.query(Bot).filter(
        Bot.id == bot_id,
        Bot.owner_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Общая статистика
    total_users = db.query(TelegramUser).filter(TelegramUser.bot_id == bot_id).count()
    active_users = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.status == "active"
    ).count()
    blocked_users = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.status == "blocked"
    ).count()
    
    # Статистика по источникам
    source_stats = db.query(
        TelegramUser.source,
        func.count(TelegramUser.id).label('count')
    ).filter(
        TelegramUser.bot_id == bot_id
    ).group_by(TelegramUser.source).all()
    
    users_by_source = {row.source or "unknown": row.count for row in source_stats}
    
    # Статистика по времени
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    users_today = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.joined_at >= today_start
    ).count()
    
    users_this_week = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.joined_at >= week_start
    ).count()
    
    users_this_month = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.joined_at >= month_start
    ).count()
    
    return BotStatsResponse(
        bot_id=bot.id,
        bot_name=bot.name,
        total_users=total_users,
        active_users=active_users,
        blocked_users=blocked_users,
        users_by_source=users_by_source,
        users_today=users_today,
        users_this_week=users_this_week,
        users_this_month=users_this_month
    )


class ConversionFunnelResponse(BaseModel):
    """Воронка конверсии"""
    step: str
    count: int
    percentage: float


class BotComparisonResponse(BaseModel):
    """Сравнение ботов"""
    bot_id: int
    bot_name: Optional[str]
    total_users: int
    active_users: int
    conversion_rate: float
    users_today: int
    users_this_week: int
    users_this_month: int


@router.get("/bots/{bot_id}/funnel", response_model=List[ConversionFunnelResponse])
async def get_conversion_funnel(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить воронку конверсии для бота"""
    bot = db.query(Bot).filter(
        Bot.id == bot_id,
        Bot.owner_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    # Шаги воронки
    total_started = db.query(TelegramUser).filter(TelegramUser.bot_id == bot_id).count()
    active_users = db.query(TelegramUser).filter(
        TelegramUser.bot_id == bot_id,
        TelegramUser.status == "active"
    ).count()
    
    # Пользователи, которые взаимодействовали (если required_interaction)
    interacted = active_users  # Упрощенная логика
    
    funnel = [
        ConversionFunnelResponse(
            step="started",
            count=total_started,
            percentage=100.0
        ),
        ConversionFunnelResponse(
            step="active",
            count=active_users,
            percentage=(active_users / total_started * 100) if total_started > 0 else 0
        ),
        ConversionFunnelResponse(
            step="interacted",
            count=interacted,
            percentage=(interacted / total_started * 100) if total_started > 0 else 0
        )
    ]
    
    return funnel


@router.get("/bots/comparison", response_model=List[BotComparisonResponse])
async def compare_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сравнить все боты пользователя"""
    bots = db.query(Bot).filter(Bot.owner_id == current_user.id).all()
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    comparison = []
    for bot in bots:
        total_users = db.query(TelegramUser).filter(TelegramUser.bot_id == bot.id).count()
        active_users = db.query(TelegramUser).filter(
            TelegramUser.bot_id == bot.id,
            TelegramUser.status == "active"
        ).count()
        
        users_today = db.query(TelegramUser).filter(
            TelegramUser.bot_id == bot.id,
            TelegramUser.joined_at >= today_start
        ).count()
        
        users_this_week = db.query(TelegramUser).filter(
            TelegramUser.bot_id == bot.id,
            TelegramUser.joined_at >= week_start
        ).count()
        
        users_this_month = db.query(TelegramUser).filter(
            TelegramUser.bot_id == bot.id,
            TelegramUser.joined_at >= month_start
        ).count()
        
        conversion_rate = (active_users / total_users * 100) if total_users > 0 else 0
        
        comparison.append(BotComparisonResponse(
            bot_id=bot.id,
            bot_name=bot.name,
            total_users=total_users,
            active_users=active_users,
            conversion_rate=conversion_rate,
            users_today=users_today,
            users_this_week=users_this_week,
            users_this_month=users_this_month
        ))
    
    return comparison

