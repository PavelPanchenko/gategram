/**
 * Тесты для triggers эндпоинтов
 */

import request from 'supertest';
import express from 'express';
import triggersRouter from '../../api/triggers';
import { cleanupTestData, createTestUser, createTestBot, getAuthToken } from '../helpers';
import prisma from '../../core/database';

const app = express();
app.use(express.json());
app.use('/api/bots/:botId/triggers', triggersRouter);

describe('Triggers API', () => {
  let testUser: any;
  let testBot: any;
  let authToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser('triggers@example.com');
    testBot = await createTestBot(testUser.id);
    authToken = getAuthToken(testUser.id, testUser.email);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/bots/:botId/triggers', () => {
    it('должен вернуть список триггеров', async () => {
      await prisma.trigger.create({
        data: {
          botId: testBot.id,
          name: 'Test Trigger',
          eventType: 'user_registered',
          conditions: {},
          actions: [],
          isActive: true,
        },
      });

      const response = await request(app)
        .get(`/api/bots/${testBot.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Test Trigger');
    });
  });

  describe('POST /api/bots/:botId/triggers', () => {
    it('должен создать новый триггер', async () => {
      const response = await request(app)
        .post(`/api/bots/${testBot.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Trigger',
          event_type: 'user_registered',
          conditions: {},
          actions: [],
          is_active: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Trigger');
      expect(response.body.event_type).toBe('user_registered');
    });
  });

  describe('PUT /api/bots/:botId/triggers/:triggerId', () => {
    it('должен обновить триггер', async () => {
      const trigger = await prisma.trigger.create({
        data: {
          botId: testBot.id,
          name: 'Old Name',
          eventType: 'user_registered',
          conditions: {},
          actions: [],
          isActive: true,
        },
      });

      const response = await request(app)
        .put(`/api/bots/${testBot.id}/triggers/${trigger.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          is_active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.is_active).toBe(false);
    });
  });

  describe('DELETE /api/bots/:botId/triggers/:triggerId', () => {
    it('должен удалить триггер', async () => {
      const trigger = await prisma.trigger.create({
        data: {
          botId: testBot.id,
          name: 'To Delete',
          eventType: 'user_registered',
          conditions: {},
          actions: [],
          isActive: true,
        },
      });

      const response = await request(app)
        .delete(`/api/bots/${testBot.id}/triggers/${trigger.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      const deletedTrigger = await prisma.trigger.findUnique({
        where: { id: trigger.id },
      });
      expect(deletedTrigger).toBeNull();
    });
  });
});
