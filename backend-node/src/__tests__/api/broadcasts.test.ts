/**
 * Тесты для broadcasts эндпоинтов
 */

import request from 'supertest';
import express from 'express';
import broadcastsRouter from '../../api/broadcasts';
import { cleanupTestData, createTestUser, createTestBot, getAuthToken, createTestTelegramUser } from '../helpers';
import prisma from '../../core/database';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/broadcasts', broadcastsRouter);

describe('Broadcasts API', () => {
  let testUser: any;
  let testBot: any;
  let authToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser('broadcasts@example.com');
    testBot = await createTestBot(testUser.id);
    authToken = getAuthToken(testUser.id, testUser.email);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/broadcasts', () => {
    it('должен вернуть список рассылок', async () => {
      // Убеждаемся, что бот существует и активен
      await prisma.bot.update({
        where: { id: testBot.id },
        data: { isActive: true },
      });

      await prisma.broadcast.create({
        data: {
          botId: testBot.id,
          ownerId: testUser.id,
          messageText: 'Test broadcast',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      const response = await request(app)
        .get('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].message_text).toBe('Test broadcast');
    });

    it('должен фильтровать по bot_id', async () => {
      // Убеждаемся, что боты активны
      await prisma.bot.update({
        where: { id: testBot.id },
        data: { isActive: true },
      });

      const bot2 = await createTestBot(testUser.id);
      await prisma.bot.update({
        where: { id: bot2.id },
        data: { isActive: true },
      });
      
      await prisma.broadcast.create({
        data: {
          botId: testBot.id,
          ownerId: testUser.id,
          messageText: 'Broadcast 1',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      await prisma.broadcast.create({
        data: {
          botId: bot2.id,
          ownerId: testUser.id,
          messageText: 'Broadcast 2',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      const response = await request(app)
        .get(`/api/broadcasts?bot_id=${testBot.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].message_text).toBe('Broadcast 1');
    });
  });

  describe('GET /api/broadcasts/:broadcastId', () => {
    it('должен вернуть информацию о рассылке', async () => {
      const broadcast = await prisma.broadcast.create({
        data: {
          botId: testBot.id,
          ownerId: testUser.id,
          messageText: 'Test broadcast',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      const response = await request(app)
        .get(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(broadcast.id);
      expect(response.body.message_text).toBe('Test broadcast');
    });

    it('должен вернуть 404 для несуществующей рассылки', async () => {
      const response = await request(app)
        .get('/api/broadcasts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/broadcasts', () => {
    it('должен создать новую рассылку', async () => {
      // Убеждаемся, что бот активен
      await prisma.bot.update({
        where: { id: testBot.id },
        data: { isActive: true },
      });

      // Создаем тестового пользователя для рассылки
      await createTestTelegramUser(testBot.id, 123456789);

      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bot_id: testBot.id,
          message_text: 'Test broadcast message',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.message_text).toBe('Test broadcast message');
      expect(response.body.status).toBe('pending');
    });

    it('должен вернуть ошибку если нет пользователей для рассылки', async () => {
      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bot_id: testBot.id,
          message_text: 'Test broadcast message',
        });

      expect(response.status).toBe(400);
      expect(response.body.detail).toContain('No users match');
    });

    it('должен вернуть ошибку при пустом message_text', async () => {
      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bot_id: testBot.id,
          message_text: '',
        });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/broadcasts/:broadcastId/cancel', () => {
    it('должен отменить рассылку', async () => {
      const broadcast = await prisma.broadcast.create({
        data: {
          botId: testBot.id,
          ownerId: testUser.id,
          messageText: 'Test broadcast',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      const response = await request(app)
        .post(`/api/broadcasts/${broadcast.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });
  });

  describe('DELETE /api/broadcasts/:broadcastId', () => {
    it('должен удалить рассылку', async () => {
      const broadcast = await prisma.broadcast.create({
        data: {
          botId: testBot.id,
          ownerId: testUser.id,
          messageText: 'Test broadcast',
          status: 'pending',
          totalUsers: 0,
          filters: {},
        },
      });

      const response = await request(app)
        .delete(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Проверяем, что рассылка удалена
      const deletedBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(deletedBroadcast).toBeNull();
    });
  });
});
