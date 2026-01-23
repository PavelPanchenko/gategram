# Тестирование

## ⚠️ ВАЖНО: Защита от удаления данных

Тесты **НЕ должны** использовать основную базу данных в продакшене!

## Настройка тестовой базы данных

### Вариант 1: Отдельная тестовая база данных (рекомендуется)

1. Создайте отдельную базу данных для тестов:

```bash
psql -U postgres -c "CREATE DATABASE gategram_test;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE gategram_test TO gategram;"
```

2. Добавьте в `.env`:

```bash
TEST_DATABASE_URL=postgresql://gategram:your-password@localhost:5432/gategram_test
```

3. Примените миграции к тестовой БД:

```bash
cd backend-node
export DATABASE_URL=$TEST_DATABASE_URL
npx prisma db push
```

### Вариант 2: Использование основной БД (только для разработки)

Если `TEST_DATABASE_URL` не указан, тесты будут использовать основную БД.

⚠️ **ВНИМАНИЕ**: Это может привести к потере данных!

## Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить тесты в watch режиме
npm run test:watch

# Запустить тесты с покрытием
npm run test:coverage
```

## Безопасность

Функция `cleanupTestData()` теперь проверяет:
- Используется ли тестовая БД
- Не запущены ли тесты в продакшене

Если попытка очистки основной БД обнаружена, тесты остановятся с ошибкой.
