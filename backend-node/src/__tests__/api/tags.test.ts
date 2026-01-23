/**
 * Тесты для user tags эндпоинтов
 */

import request from 'supertest';
import express from 'express';
import userTagsRouter from '../../api/userTags';
import { cleanupTestData, createTestUser, createTestBot, createTestTelegramUser, getAuthToken } from '../helpers';
import prisma from '../../core/database';

const app = express();
app.use(express.json());
app.use('/api/bots/:botId/tags', userTagsRouter);

describe('User Tags API', () => {
  let testUser: any;
  let testBot: any;
  let authToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser('tags@example.com');
    testBot = await createTestBot(testUser.id);
    authToken = getAuthToken(testUser.id, testUser.email);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/bots/:botId/tags', () => {
    it('должен вернуть список тегов', async () => {
      await prisma.userTag.create({
        data: {
          botId: testBot.id,
          name: 'VIP',
          color: '#FF0000',
          description: 'VIP users',
        },
      });

      const response = await request(app)
        .get(`/api/bots/${testBot.id}/tags`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('VIP');
    });
  });

  describe('POST /api/bots/:botId/tags', () => {
    it('должен создать новый тег', async () => {
      const response = await request(app)
        .post(`/api/bots/${testBot.id}/tags`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Tag',
          color: '#00FF00',
          description: 'New tag description',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Tag');
      expect(response.body.color).toBe('#00FF00');
    });

    it('должен вернуть ошибку при дублировании имени тега', async () => {
      await prisma.userTag.create({
        data: {
          botId: testBot.id,
          name: 'Existing Tag',
          color: '#0000FF',
        },
      });

      const response = await request(app)
        .post(`/api/bots/${testBot.id}/tags`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Existing Tag',
          color: '#FF0000',
        });

      expect(response.status).toBe(400);
      expect(response.body.detail).toContain('already exists');
    });
  });

  describe('POST /api/bots/:botId/tags/users/:userId/assign', () => {
    it('должен назначить теги пользователю', async () => {
      const user = await createTestTelegramUser(testBot.id, 111);
      const tag1 = await prisma.userTag.create({
        data: {
          botId: testBot.id,
          name: 'Tag 1',
          color: '#FF0000',
        },
      });
      const tag2 = await prisma.userTag.create({
        data: {
          botId: testBot.id,
          name: 'Tag 2',
          color: '#00FF00',
        },
      });

      const response = await request(app)
        .post(`/api/bots/${testBot.id}/tags/users/${user.id}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tag_ids: [tag1.id, tag2.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Assigned 2 tags');

      // Проверяем, что теги назначены
      const updatedUser = await prisma.telegramUser.findUnique({
        where: { id: user.id },
        include: { tags: true },
      });
      expect(updatedUser?.tags.length).toBe(2);
    });
  });
});
