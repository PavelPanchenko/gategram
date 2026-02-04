import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../core/database';
import { hashPassword, verifyPassword } from '../utils/password';
import { createAccessToken, createRefreshToken } from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Схемы валидации
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Регистрация
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = registerSchema.parse(req.body);

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ detail: 'Email already registered' });
      return;
    }

    // Создаем нового пользователя
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        isActive: true,
        isSuperuser: false,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      is_active: user.isActive,
      is_superuser: user.isSuperuser,
      created_at: user.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ detail: error.errors });
      return;
    }
    throw error;
  }
});

// Вход
router.post('/login', async (req: Request, res: Response) => {
  const timingEnabled = process.env.AUTH_TIMING === '1' || process.env.AUTH_TIMING === 'true';
  const t0 = timingEnabled ? process.hrtime.bigint() : 0n;
  const marks: Record<string, number> = {};

  try {
    const { email, password } = loginSchema.parse(req.body);

    // Находим пользователя
    const tDb0 = timingEnabled ? process.hrtime.bigint() : 0n;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (timingEnabled) {
      marks.db_ms = Number(process.hrtime.bigint() - tDb0) / 1e6;
    }

    if (!user || !user.isActive) {
      res.status(401).json({ detail: 'Incorrect email or password' });
      return;
    }

    // Проверяем пароль
    const tBcrypt0 = timingEnabled ? process.hrtime.bigint() : 0n;
    const isValidPassword = await verifyPassword(password, user.hashedPassword);
    if (timingEnabled) {
      marks.bcrypt_ms = Number(process.hrtime.bigint() - tBcrypt0) / 1e6;
    }
    if (!isValidPassword) {
      res.status(401).json({ detail: 'Incorrect email or password' });
      return;
    }

    // Создаем токены
    const tJwt0 = timingEnabled ? process.hrtime.bigint() : 0n;
    const accessToken = createAccessToken({ userId: user.id, email: user.email });
    const refreshToken = createRefreshToken({ userId: user.id, email: user.email });
    if (timingEnabled) {
      marks.jwt_ms = Number(process.hrtime.bigint() - tJwt0) / 1e6;
    }

    if (timingEnabled) {
      marks.total_ms = Number(process.hrtime.bigint() - t0) / 1e6;
      // Показывается в DevTools → Network → Timing (Server-Timing)
      res.setHeader(
        'Server-Timing',
        `db;dur=${marks.db_ms?.toFixed(1)}, bcrypt;dur=${marks.bcrypt_ms?.toFixed(1)}, jwt;dur=${marks.jwt_ms?.toFixed(1)}, total;dur=${marks.total_ms?.toFixed(1)}`
      );
    }

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ detail: error.errors });
      return;
    }
    throw error;
  }
});

// Обновление токена
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ detail: 'Refresh token required' });
      return;
    }

    // Валидируем refresh token с проверкой типа
    const { verifyToken } = await import('../utils/jwt');
    const payload = verifyToken(refresh_token, 'refresh');

    // Проверяем, что пользователь существует и активен
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ detail: 'User not found or inactive' });
      return;
    }

    // Создаем новые токены
    const accessToken = createAccessToken({ userId: user.id, email: user.email });
    const refreshToken = createRefreshToken({ userId: user.id, email: user.email });

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid refresh token';
    res.status(401).json({ detail: errorMessage });
  }
});

// Получить информацию о текущем пользователе
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ detail: 'Unauthorized' });
      return;
    }

    // Получаем пользователя из БД
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      is_active: user.isActive,
      is_superuser: user.isSuperuser,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
