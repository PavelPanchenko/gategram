import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';

// Расширяем тип Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ detail: 'Authentication required' });
      return;
    }

    // Проверяем, что это access token
    const payload = verifyToken(token, 'access');
    req.user = payload;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid or expired token';
    // Если токен истек, возвращаем более понятное сообщение
    if (errorMessage.includes('expired')) {
      res.status(401).json({ detail: 'Token expired. Please refresh your session.' });
    } else {
      res.status(401).json({ detail: errorMessage });
    }
  }
}
