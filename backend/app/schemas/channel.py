from pydantic import BaseModel, Field, HttpUrl
from typing import Optional


class Channel(BaseModel):
    """Модель канала"""
    name: str = Field(..., min_length=1, max_length=100, description="Название канала")
    url: str = Field(..., description="URL канала (https://t.me/...)")

