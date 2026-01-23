/**
 * Тесты для auth эндпоинтов
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../../api/auth';
import { cleanupTestData, createTestUser, getAuthToken } from '../helpers';
import prisma from '../../core/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('должен зарегистрировать нового пользователя', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('newuser@example.com');
      expect(response.body.is_active).toBe(true);
      expect(response.body.is_superuser).toBe(false);
    });

    it('должен вернуть ошибку при регистрации с существующим email', async () => {
      await createTestUser('existing@example.com');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.detail).toBe('Email already registered');
    });

    it('должен вернуть ошибку при невалидных данных', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // слишком короткий
        });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('должен успешно авторизовать пользователя', async () => {
      await createTestUser('login@example.com', 'password123');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.token_type).toBe('bearer');
    });

    it('должен вернуть ошибку при неверном пароле', async () => {
      await createTestUser('login2@example.com', 'password123');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login2@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.detail).toBe('Incorrect email or password');
    });

    it('должен вернуть ошибку при несуществующем пользователе', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.detail).toBe('Incorrect email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('должен вернуть информацию о текущем пользователе', async () => {
      const user = await createTestUser('me@example.com');
      const token = getAuthToken(user.id, user.email);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe('me@example.com');
    });

    it('должен вернуть ошибку без токена', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('должен вернуть ошибку с невалидным токеном', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('должен обновить токен', async () => {
      const user = await createTestUser('refresh@example.com');
      const { createRefreshToken } = await import('../../utils/jwt');
      const refreshToken = createRefreshToken({ userId: user.id, email: user.email });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refresh_token: refreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.token_type).toBe('bearer');
    });

    it('должен вернуть ошибку при отсутствии refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.detail).toBe('Refresh token required');
    });

    it('должен вернуть ошибку при невалидном refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refresh_token: 'invalid-token',
        });

      expect(response.status).toBe(401);
    });
  });
});
