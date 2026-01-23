FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm ci || npm install

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем исходный код
COPY . .

# Открываем порт
EXPOSE 8001

# В dev режиме используем tsx watch, в production - собираем и запускаем
CMD ["npm", "run", "dev"]
