import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Определяем корневую директорию проекта (GateGram)
// __dirname будет:
//   - backend-node/dist/core/ (в production после сборки)
//   - backend-node/src/core/ (в dev при tsx watch)
// В обоих случаях нужно подняться на 3 уровня вверх до корня проекта (GateGram)
const projectRoot = path.resolve(__dirname, '../../..'); // core -> src/dist -> backend-node -> GateGram

// Отладочное логирование (только в dev режиме)
if (process.env.NODE_ENV !== 'production') {
  console.log(`🔍 Config debug:`);
  console.log(`   __dirname: ${__dirname}`);
  console.log(`   projectRoot: ${projectRoot}`);
}

// Пытаемся загрузить переменные из разных мест (в порядке приоритета)
const envPaths: string[] = [
  process.env.ENV_FILE_PATH || '',              // Явно указанный путь
  path.join(projectRoot, '.env'),               // .env в корне проекта (основной)
  path.join(projectRoot, 'backend-node/.env'),  // backend-node/.env (резервный)
  path.join(__dirname, '../.env'),               // Локальный .env
].filter(p => p); // Убираем пустые строки

// Загружаем первый найденный файл
let loadedEnvPath: string | null = null;
for (const envPath of envPaths) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Checking: ${envPath} ${existsSync(envPath) ? '✅' : '❌'}`);
  }
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedEnvPath = envPath;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Loaded .env from: ${envPath}`);
    }
    break;
  }
}

// Если переменные все еще не загружены, пробуем стандартную загрузку dotenv
if (!process.env.DATABASE_URL && !process.env.REDIS_URL) {
  dotenv.config(); // Загрузит .env из текущей директории, если есть
}

// Нормализация DATABASE_URL - исправляем возможные проблемы с форматом
function normalizeDatabaseUrl(url: string): string {
  if (!url) return '';
  
  // Убираем лишние пробелы
  url = url.trim();
  
  // Если начинается с postgres://, меняем на postgresql:// (Prisma требует postgresql://)
  if (url.startsWith('postgres://')) {
    url = url.replace('postgres://', 'postgresql://');
  }
  
  // Сначала пытаемся вручную извлечь компоненты и экранировать пароль
  // Это нужно делать ДО попытки парсинга, так как неэкранированные символы делают URL невалидным
  // Используем более точный regex, который правильно обрабатывает пароли со специальными символами
  const urlMatch = url.match(/^(postgresql?:\/\/)([^:@]+):([^@]+)@([^\/]+)(\/.+)?$/);
  
  if (urlMatch) {
    const [, protocol, username, password, hostPort, database] = urlMatch;
    
    // Декодируем пароль, если он уже был закодирован
    let decodedPassword: string;
    try {
      decodedPassword = decodeURIComponent(password);
    } catch {
      decodedPassword = password;
    }
    
    // Экранируем пароль (все специальные символы должны быть закодированы)
    const encodedPassword = encodeURIComponent(decodedPassword);
    
    // Пересобираем URL с экранированным паролем
    const normalizedUrl = `${protocol}${username}:${encodedPassword}@${hostPort}${database || ''}`;
    
    // Проверяем, что теперь URL валидный
    try {
      const parsedUrl = new URL(normalizedUrl);
      
      if (process.env.NODE_ENV !== 'production' && password !== encodedPassword) {
        console.log('🔧 Encoded special characters in database password');
      }
      
      return normalizedUrl;
    } catch (error) {
      // Если все еще не работает, логируем и возвращаем исходный
      console.warn('⚠️  Warning: Could not normalize DATABASE_URL after encoding password');
      console.warn('   Error:', error instanceof Error ? error.message : String(error));
      return url;
    }
  }
  
  // Если не удалось распарсить через regex, пробуем стандартный парсинг
  // Но сначала попробуем закодировать пароль вручную
  try {
    // Пробуем разобрать URL, игнорируя ошибки парсинга
    const urlObj = new URL(url);
    // Если пароль содержит незакодированные символы, кодируем его
    if (urlObj.password && (urlObj.password.includes('/') || urlObj.password.includes('+') || urlObj.password.includes('='))) {
      const encodedPwd = encodeURIComponent(urlObj.password);
      urlObj.password = encodedPwd;
      return urlObj.toString();
    }
    return url; // URL уже валидный
  } catch (error) {
    // Если не удалось распарсить, возвращаем как есть
    // Валидация ниже покажет точную ошибку
    console.warn('⚠️  Warning: Could not parse DATABASE_URL');
    return url;
  }
}

export const config = {
  // App
  appName: process.env.APP_NAME || 'GateGram',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8001', 10),
  debug: process.env.DEBUG === 'true',

  // Database - нормализуем URL
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL || ''),
  
  // Redis
  redisUrl: process.env.REDIS_URL || '',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),

  // JWT
  secretKey: process.env.SECRET_KEY || 'your-secret-key-change-in-production',
  algorithm: process.env.ALGORITHM || 'HS256',
  accessTokenExpireMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '30', 10),
  refreshTokenExpireDays: parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '7', 10),

  // CORS
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'],

  // Telegram
  telegramApiUrl: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
};

// Валидация и проверка формата DATABASE_URL
if (!config.databaseUrl) {
  console.error('❌ DATABASE_URL not found!');
  if (loadedEnvPath) {
    console.error(`   Loaded .env from: ${loadedEnvPath}`);
  } else {
    console.error('   Searched in:', envPaths.join(', '));
  }
  console.error('   Please create .env file with DATABASE_URL');
  throw new Error('DATABASE_URL must be set in .env');
}

// Проверяем формат DATABASE_URL
try {
  const dbUrl = new URL(config.databaseUrl);
  
  // Проверяем обязательные компоненты
  if (!dbUrl.protocol || !dbUrl.hostname || !dbUrl.pathname) {
    throw new Error('Missing required URL components');
  }
  
  // Проверяем, что протокол правильный
  if (!['postgresql:', 'postgres:'].includes(dbUrl.protocol)) {
    throw new Error(`Invalid protocol: ${dbUrl.protocol}. Expected postgresql: or postgres:`);
  }
  
  // Проверяем порт (если указан)
  if (dbUrl.port && (isNaN(parseInt(dbUrl.port)) || parseInt(dbUrl.port) < 1 || parseInt(dbUrl.port) > 65535)) {
    throw new Error(`Invalid port number: ${dbUrl.port}`);
  }
  
  if (process.env.NODE_ENV !== 'production') {
    const maskedUrl = `${dbUrl.protocol}//${dbUrl.username || '***'}:****@${dbUrl.hostname}:${dbUrl.port || '5432'}/${dbUrl.pathname.slice(1)}`;
    console.log(`✅ DATABASE_URL format is valid: ${maskedUrl}`);
  }
} catch (error) {
  console.error('❌ DATABASE_URL has invalid format!');
  console.error('   Error:', error instanceof Error ? error.message : String(error));
  console.error('   Expected format: postgresql://user:password@host:port/database');
  console.error('   Current value (masked):', config.databaseUrl.replace(/:[^:@]+@/, ':****@'));
  throw new Error(`DATABASE_URL has invalid format: ${error instanceof Error ? error.message : String(error)}`);
}

if (!config.redisUrl) {
  console.error('❌ REDIS_URL not found!');
  console.error('   Please create .env file with REDIS_URL');
  throw new Error('REDIS_URL must be set in .env');
}
