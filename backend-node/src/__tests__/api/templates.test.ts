/**
 * Тесты для message templates эндпоинтов
 */

import request from 'supertest';
import express from 'express';
import messageTemplatesRouter from '../../api/messageTemplates';
import { cleanupTestData, createTestUser, createTestBot, getAuthToken } from '../helpers';
import prisma from '../../core/database';

const app = express();
app.use(express.json());
app.use('/api/bots/:botId/templates', messageTemplatesRouter);

describe('Message Templates API', () => {
  let testUser: any;
  let testBot: any;
  let authToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser('templates@example.com');
    testBot = await createTestBot(testUser.id);
    authToken = getAuthToken(testUser.id, testUser.email);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/bots/:botId/templates', () => {
    it('должен вернуть список шаблонов', async () => {
      await prisma.messageTemplate.create({
        data: {
          botId: testBot.id,
          name: 'Welcome Template',
          content: 'Welcome {{user_name}}!',
          variables: {},
          isActive: true,
        },
      });

      const response = await request(app)
        .get(`/api/bots/${testBot.id}/templates`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Welcome Template');
    });
  });

  describe('POST /api/bots/:botId/templates', () => {
    it('должен создать новый шаблон', async () => {
      const response = await request(app)
        .post(`/api/bots/${testBot.id}/templates`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Template',
          content: 'Hello {{user_name}}!',
          variables: { user_name: 'Имя пользователя' },
          is_active: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Template');
      expect(response.body.content).toBe('Hello {{user_name}}!');
    });
  });

  describe('PUT /api/bots/:botId/templates/:templateId', () => {
    it('должен обновить шаблон', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          botId: testBot.id,
          name: 'Old Name',
          content: 'Old content',
          variables: {},
          isActive: true,
        },
      });

      const response = await request(app)
        .put(`/api/bots/${testBot.id}/templates/${template.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          content: 'Updated content',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.content).toBe('Updated content');
    });
  });

  describe('DELETE /api/bots/:botId/templates/:templateId', () => {
    it('должен удалить шаблон', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          botId: testBot.id,
          name: 'To Delete',
          content: 'Content',
          variables: {},
          isActive: true,
        },
      });

      const response = await request(app)
        .delete(`/api/bots/${testBot.id}/templates/${template.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      const deletedTemplate = await prisma.messageTemplate.findUnique({
        where: { id: template.id },
      });
      expect(deletedTemplate).toBeNull();
    });
  });
});
