import jwt from 'jsonwebtoken';
import { config } from '../core/config';

export interface TokenPayload {
  userId: number;
  email: string;
  type?: 'access' | 'refresh'; // Добавляем тип токена
}

export function createAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.secretKey,
    {
      algorithm: config.algorithm as jwt.Algorithm,
      expiresIn: `${config.accessTokenExpireMinutes}m`,
    }
  );
}

export function createRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.secretKey,
    {
      algorithm: config.algorithm as jwt.Algorithm,
      expiresIn: `${config.refreshTokenExpireDays}d`,
    }
  );
}

export function verifyToken(token: string, expectedType?: 'access' | 'refresh'): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.secretKey, {
      algorithms: [config.algorithm as jwt.Algorithm],
    }) as TokenPayload & { type?: string };

    // Проверяем тип токена, если указан
    if (expectedType && decoded.type !== expectedType) {
      throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
    }

    return decoded as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}
