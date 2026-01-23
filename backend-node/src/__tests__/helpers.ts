/**
 * Вспомогательные функции для тестов
 */

import prisma from '../core/database';
import { createAccessToken } from '../utils/jwt';

/**
 * Создает тестового пользователя
 */
export async function createTestUser(email: string = 'test@example.com', password: string = 'testpassword123') {
  const { hashPassword } = await import('../utils/password');
  const hashedPassword = await hashPassword(password);
  
  return await prisma.user.create({
    data: {
      email,
      hashedPassword,
      isActive: true,
      isSuperuser: false,
    },
  });
}

/**
 * Создает тестового бота
 */
export async function createTestBot(ownerId: number, token?: string) {
  // Генерируем уникальный токен если не передан
  const uniqueToken = token || `${Date.now()}:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`;
  return await prisma.bot.create({
    data: {
      ownerId,
      token: uniqueToken,
      username: 'test_bot',
      name: 'Test Bot',
      isActive: true,
      welcomeMessage: 'Welcome!',
      requiredInteraction: true,
      interactionDelaySeconds: 5,
      continueButtonText: '✅ Продолжить',
      channels: [],
      settings: {},
    },
  });
}

/**
 * Создает тестового Telegram пользователя
 */
export async function createTestTelegramUser(botId: number, telegramUserId: number = 123456789) {
  return await prisma.telegramUser.create({
    data: {
      botId,
      telegramUserId: BigInt(telegramUserId),
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      source: 'test',
      status: 'active',
    },
  });
}

/**
 * Получает токен для авторизации
 */
export function getAuthToken(userId: number, email: string = 'test@example.com'): string {
  return createAccessToken({ userId, email });
}

/**
 * Очищает тестовые данные
 * ВАЖНО: Эта функция удаляет ВСЕ данные из базы!
 * Используйте только в тестах с отдельной тестовой БД.
 */
export async function cleanupTestData() {
  // Проверяем, что мы не в продакшене и используем тестовую БД
  const dbUrl = process.env.DATABASE_URL || '';
  const isTestDb = dbUrl.includes('test') || process.env.TEST_DATABASE_URL || process.env.NODE_ENV === 'test';
  
  if (!isTestDb && process.env.NODE_ENV !== 'test') {
    console.error('❌ ERROR: Attempted to cleanup data in non-test database!');
    console.error('   This is a safety check to prevent data loss.');
    throw new Error('Cannot cleanup data in production database. Use TEST_DATABASE_URL for tests.');
  }

  // Удаляем в правильном порядке из-за foreign keys
  try {
    await prisma.broadcastLog.deleteMany({});
    await prisma.broadcast.deleteMany({});
    await prisma.trigger.deleteMany({});
    await prisma.messageTemplate.deleteMany({});
    await prisma.userTag.deleteMany({});
    await prisma.telegramUser.deleteMany({});
    await prisma.bot.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (error) {
    // Игнорируем ошибки при очистке
    console.warn('Error during cleanup:', error);
  }
}
