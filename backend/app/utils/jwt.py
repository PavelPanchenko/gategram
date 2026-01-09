from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings
from app.schemas.auth import TokenData


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создает JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Создает JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """Верифицирует JWT token и возвращает данные"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type_in_payload = payload.get("type")
        if token_type_in_payload != token_type:
            return None
        sub = payload.get("sub")
        email: str = payload.get("email")
        if sub is None or email is None:
            return None
        # Конвертируем sub (строка) обратно в int
        try:
            user_id: int = int(sub)
        except (ValueError, TypeError):
            return None
        return TokenData(user_id=user_id, email=email)
    except JWTError:
        return None

