from pydantic import BaseModel, Field


class SendMessageRequest(BaseModel):
    message_text: str = Field(..., min_length=1, max_length=4096, description="Текст сообщения")


class BlockUserRequest(BaseModel):
    blocked: bool = Field(True, description="True для блокировки, False для разблокировки")

