/**
 * Тесты для broadcastFilters
 */

import { filterUsersForBroadcast, BroadcastFilters } from '../../utils/broadcastFilters';
import { cleanupTestData, createTestUser, createTestBot, createTestTelegramUser } from '../helpers';
import prisma from '../../core/database';

describe('Broadcast Filters', () => {
  let testUser: any;
  let testBot: any;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser('filter@example.com');
    testBot = await createTestBot(testUser.id);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('должен вернуть всех активных пользователей без фильтров', async () => {
    await createTestTelegramUser(testBot.id, 111);
    await createTestTelegramUser(testBot.id, 222);
    await createTestTelegramUser(testBot.id, 333);

    const userIds = await filterUsersForBroadcast(testBot.id, {});
    expect(userIds.length).toBe(3);
  });

  it('должен фильтровать только активных пользователей', async () => {
    const activeUser = await createTestTelegramUser(testBot.id, 111);
    const blockedUser = await createTestTelegramUser(testBot.id, 222);
    
    await prisma.telegramUser.update({
      where: { id: blockedUser.id },
      data: { status: 'blocked' },
    });

    const userIds = await filterUsersForBroadcast(testBot.id, {});
    expect(userIds.length).toBe(1);
    expect(userIds[0]).toBe(activeUser.id);
  });

  it('должен фильтровать по источнику', async () => {
    await createTestTelegramUser(testBot.id, 111);
    const user2 = await createTestTelegramUser(testBot.id, 222);
    
    await prisma.telegramUser.update({
      where: { id: user2.id },
      data: { source: 'telegram' },
    });

    const filters: BroadcastFilters = { source: 'telegram' };
    const userIds = await filterUsersForBroadcast(testBot.id, filters);
    expect(userIds.length).toBe(1);
    expect(userIds[0]).toBe(user2.id);
  });

  it('должен фильтровать новых пользователей', async () => {
    const oldUser = await createTestTelegramUser(testBot.id, 111);
    // Устанавливаем дату регистрации на 10 дней назад
    await prisma.telegramUser.update({
      where: { id: oldUser.id },
      data: {
        joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    const newUser = await createTestTelegramUser(testBot.id, 222);

    const filters: BroadcastFilters = { new_users_days: 7 };
    const userIds = await filterUsersForBroadcast(testBot.id, filters);
    expect(userIds.length).toBe(1);
    expect(userIds[0]).toBe(newUser.id);
  });

  it('должен фильтровать неактивных пользователей', async () => {
    const activeUser = await createTestTelegramUser(testBot.id, 111);
    const inactiveUser = await createTestTelegramUser(testBot.id, 222);
    
    // Устанавливаем последнюю активность на 10 дней назад
    await prisma.telegramUser.update({
      where: { id: inactiveUser.id },
      data: {
        lastActivity: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    const filters: BroadcastFilters = { inactive_days: 7 };
    const userIds = await filterUsersForBroadcast(testBot.id, filters);
    expect(userIds.length).toBe(1);
    expect(userIds[0]).toBe(inactiveUser.id);
  });

  it('должен фильтровать по тегам', async () => {
    const user1 = await createTestTelegramUser(testBot.id, 111);
    const user2 = await createTestTelegramUser(testBot.id, 222);

    // Создаем тег
    const tag = await prisma.userTag.create({
      data: {
        botId: testBot.id,
        name: 'vip',
        color: '#FF0000',
      },
    });

    // Назначаем тег только первому пользователю
    await prisma.telegramUser.update({
      where: { id: user1.id },
      data: {
        tags: {
          connect: { id: tag.id },
        },
      },
    });

    const filters: BroadcastFilters = { tags: ['vip'] };
    const userIds = await filterUsersForBroadcast(testBot.id, filters);
    expect(userIds.length).toBe(1);
    expect(userIds[0]).toBe(user1.id);
  });

  it('должен вернуть пустой список если теги не найдены', async () => {
    await createTestTelegramUser(testBot.id, 111);

    const filters: BroadcastFilters = { tags: ['nonexistent'] };
    const userIds = await filterUsersForBroadcast(testBot.id, filters);
    expect(userIds.length).toBe(0);
  });
});
