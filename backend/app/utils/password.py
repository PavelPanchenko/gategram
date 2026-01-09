import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Хеширует пароль"""
    # Обрезаем пароль до 72 байт (лимит bcrypt)
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')
