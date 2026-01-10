from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import SessionLocal
from app.api import auth, bots, broadcasts, analytics, message_templates, user_tags, triggers, global_templates, global_tags, global_triggers, global_users, health
from app.models.bot import Bot
from app.services.bot_manager import bot_manager
from app.services.bot_handlers import setup_bot_handlers
from aiogram import Router
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup: загружаем и запускаем активных ботов
    logger.info("=== LIFESPAN STARTUP ===")
    db = SessionLocal()
    try:
        active_bots = db.query(Bot).filter(Bot.is_active == True).all()
        logger.info(f"Found {len(active_bots)} active bots to start")
        print(f"Found {len(active_bots)} active bots to start")  # Также в stdout
        for bot in active_bots:
            logger.info(f"Starting bot {bot.id} (token: {bot.token[:10]}...)")
            print(f"Starting bot {bot.id}")  # Также в stdout
            success = await bot_manager.start_bot(bot.id, bot.token, setup_bot_handlers)
            if success:
                logger.info(f"Bot {bot.id} started successfully")
                print(f"Bot {bot.id} started successfully")  # Также в stdout
            else:
                logger.error(f"Failed to start bot {bot.id}")
                print(f"Failed to start bot {bot.id}")  # Также в stdout
    except Exception as e:
        logger.error(f"Error starting bots: {e}", exc_info=True)
        print(f"Error starting bots: {e}")  # Также в stdout
    finally:
        db.close()
    logger.info("=== LIFESPAN STARTUP COMPLETE ===")
    print("=== LIFESPAN STARTUP COMPLETE ===")  # Также в stdout
    
    yield
    
    # Shutdown: останавливаем всех ботов
    logger.info("=== LIFESPAN SHUTDOWN ===")
    await bot_manager.stop_all()


# CORS настройки - определяем ДО создания приложения
cors_origins = settings.cors_origins_list
# Для разработки разрешаем все origins, если список пуст
if not cors_origins or len(cors_origins) == 0:
    cors_origins = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"]

logger.info(f"CORS origins: {cors_origins}")


# Middleware для безопасной обработки ошибок валидации с бинарными данными
class ValidationErrorMiddleware(BaseHTTPMiddleware):
    """Middleware для перехвата ошибок валидации до стандартного обработчика FastAPI"""
    
    async def dispatch(self, request: StarletteRequest, call_next):
        try:
            response = await call_next(request)
            return response
        except RequestValidationError as exc:
            # Безопасно обрабатываем ошибки валидации
            cleaned_errors = []
            try:
                raw_errors = exc.errors()
                for error in raw_errors:
                    try:
                        # Пропускаем ошибки, связанные с файлами
                        loc = error.get("loc", [])
                        if any("media_file" in str(l).lower() for l in loc):
                            continue
                        
                        # Очищаем ошибку от бинарных данных
                        cleaned_error = {}
                        for key, value in error.items():
                            try:
                                if isinstance(value, bytes):
                                    cleaned_error[key] = "<binary data>"
                                elif isinstance(value, dict):
                                    cleaned_error[key] = {
                                        k: ("<binary data>" if isinstance(v, bytes) else v) 
                                        for k, v in value.items()
                                    }
                                else:
                                    cleaned_error[key] = value
                            except Exception:
                                cleaned_error[key] = "<unserializable>"
                        cleaned_errors.append(cleaned_error)
                    except Exception:
                        continue
            except (UnicodeDecodeError, TypeError, ValueError) as e:
                logger.warning(f"Could not process validation errors due to binary data: {e}")
                cleaned_errors = [
                    {
                        "type": "validation_error",
                        "msg": "Validation error occurred. Please check your form data.",
                        "loc": ["body"]
                    }
                ]
            except Exception as e:
                logger.error(f"Unexpected error processing validation: {e}", exc_info=True)
                cleaned_errors = [
                    {
                        "type": "validation_error",
                        "msg": "Validation error occurred",
                        "loc": ["body"]
                    }
                ]
            
            if not cleaned_errors:
                cleaned_errors = [
                    {
                        "type": "validation_error",
                        "msg": "Validation error occurred. Please check your form data.",
                        "loc": ["body"]
                    }
                ]
            
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"detail": cleaned_errors},
                headers={
                    "Access-Control-Allow-Origin": cors_origins[0] if cors_origins else "*",
                    "Access-Control-Allow-Credentials": "true",
                }
            )


# Обработчик ошибок валидации - определяем ДО создания приложения
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации, который исключает бинарные данные из ответа"""
    # Безопасно получаем ошибки, обрабатывая возможные исключения при сериализации
    cleaned_errors = []
    try:
        raw_errors = exc.errors()
        for error in raw_errors:
            try:
                # Пропускаем ошибки, связанные с файлами
                loc = error.get("loc", [])
                if any("media_file" in str(l).lower() for l in loc):
                    continue
                
                # Очищаем ошибку от бинарных данных
                cleaned_error = {}
                for key, value in error.items():
                    try:
                        if isinstance(value, bytes):
                            cleaned_error[key] = "<binary data>"
                        elif isinstance(value, dict):
                            cleaned_error[key] = {
                                k: ("<binary data>" if isinstance(v, bytes) else v) 
                                for k, v in value.items()
                            }
                        else:
                            # Пытаемся сериализовать значение
                            cleaned_error[key] = value
                    except Exception:
                        cleaned_error[key] = "<unserializable>"
                cleaned_errors.append(cleaned_error)
            except Exception:
                # Пропускаем ошибки, которые не удалось обработать
                continue
    except (UnicodeDecodeError, TypeError, ValueError) as e:
        # Если не удалось получить ошибки из-за бинарных данных, возвращаем общее сообщение
        logger.warning(f"Could not process validation errors due to binary data: {e}")
        cleaned_errors = [
            {
                "type": "validation_error",
                "msg": "Validation error occurred. Please check your form data.",
                "loc": ["body"]
            }
        ]
    except Exception as e:
        logger.error(f"Unexpected error processing validation: {e}", exc_info=True)
        cleaned_errors = [
            {
                "type": "validation_error",
                "msg": "Validation error occurred",
                "loc": ["body"]
            }
        ]
    
    # Если все ошибки были отфильтрованы, возвращаем общее сообщение
    if not cleaned_errors:
        cleaned_errors = [
            {
                "type": "validation_error",
                "msg": "Validation error occurred. Please check your form data.",
                "loc": ["body"]
            }
        ]
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": cleaned_errors},
        headers={
            "Access-Control-Allow-Origin": cors_origins[0] if cors_origins else "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )


app = FastAPI(
    title="GateGram API",
    description="Telegram traffic gateway API",
    version="1.0.0",
    lifespan=lifespan,
)

# Добавляем middleware для обработки ошибок валидации ПЕРЕД CORS
app.add_middleware(ValidationErrorMiddleware)

# Также регистрируем обработчик через add_exception_handler для гарантии
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Подключаем роутеры
app.include_router(auth.router)
app.include_router(bots.router)
app.include_router(broadcasts.router)
app.include_router(analytics.router)
app.include_router(message_templates.router)
app.include_router(user_tags.router)
app.include_router(triggers.router)
app.include_router(global_templates.router)
app.include_router(global_tags.router)
app.include_router(global_triggers.router)
app.include_router(global_users.router)
app.include_router(health.router)


@app.get("/")
async def root():
    return {"message": "GateGram API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Глобальный обработчик ошибок для добавления CORS заголовков
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": cors_origins[0] if cors_origins else "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

