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
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ detail: 'Incorrect email or password' });
      return;
    }

    // Проверяем пароль
    const isValidPassword = await verifyPassword(password, user.hashedPassword);
    if (!isValidPassword) {
      res.status(401).json({ detail: 'Incorrect email or password' });
      return;
    }

    // Создаем токены
    const accessToken = createAccessToken({ userId: user.id, email: user.email });
    const refreshToken = createRefreshToken({ userId: user.id, email: user.email });

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
