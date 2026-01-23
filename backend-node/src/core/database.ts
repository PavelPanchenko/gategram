import { PrismaClient } from '@prisma/client';
import { config } from './config';

// Определяем, какую БД использовать
// В тестах приоритет у TEST_DATABASE_URL (устанавливается в setup.ts ДО загрузки config)
let databaseUrl: string;
if (process.env.TEST_DATABASE_URL && (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID)) {
  databaseUrl = process.env.TEST_DATABASE_URL;
} else if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !== config.databaseUrl &&
  !(process.env.DATABASE_URL_HOST || process.env.DATABASE_URL_PORT)
) {
  // Если DATABASE_URL уже установлен (например, в setup.ts), используем его
  databaseUrl = process.env.DATABASE_URL;
} else {
  // Иначе используем из config
  databaseUrl = config.databaseUrl;
}

// Устанавливаем для Prisma
process.env.DATABASE_URL = databaseUrl;

// Маскируем пароль для логирования
const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');

if (process.env.NODE_ENV !== 'production') {
  console.log(`🔗 Database URL: ${maskedUrl}`);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
