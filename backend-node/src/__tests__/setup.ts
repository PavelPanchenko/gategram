/**
 * Настройка тестового окружения
 */

// Загружаем переменные окружения для тестов
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
const envPath = path.join(__dirname, '../../.env');
const envResult = dotenv.config({ path: envPath, override: false });

// Проверяем, что файл загружен
if (envResult.error) {
  console.warn('⚠️  Could not load .env file:', envResult.error.message);
} else if (envResult.parsed) {
  console.log('✅ Loaded .env file for tests');
  // Выводим все загруженные переменные для отладки (только в dev)
  if (process.env.NODE_ENV === 'development') {
    console.log('   Loaded variables:', Object.keys(envResult.parsed).join(', '));
  }
}

// ВАЖНО: Используем отдельную тестовую базу данных, если указана
// Если TEST_DATABASE_URL не указан, используем основную БД (только для разработки!)
// Проверяем и в process.env и в envResult.parsed
const testDbUrl = process.env.TEST_DATABASE_URL || envResult.parsed?.TEST_DATABASE_URL;
if (testDbUrl) {
  // Устанавливаем ДО того, как config.ts загрузится
  process.env.DATABASE_URL = testDbUrl;
  // Также устанавливаем для Prisma
  process.env.TEST_DATABASE_URL = testDbUrl;
  console.log('🧪 Using test database:', testDbUrl.replace(/:([^:@]+)@/, ':****@'));
} else {
  console.warn('⚠️  WARNING: Tests are using the main database!');
  console.warn('   Set TEST_DATABASE_URL in .env to use a separate test database.');
  console.warn('   Example: TEST_DATABASE_URL=postgresql://gategram:password@localhost:5432/gategram_test');
  console.warn('   Current DATABASE_URL will be used:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@') || 'not set');
}

// Увеличиваем таймаут для тестов с БД
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}
