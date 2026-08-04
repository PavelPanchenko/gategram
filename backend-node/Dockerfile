FROM node:20-alpine

WORKDIR /app

# Prisma (Alpine) needs OpenSSL runtime libs
RUN apk add --no-cache openssl libc6-compat

# Копируем файлы зависимостей
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm ci || npm install

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем исходный код и собираем
COPY . .
RUN npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
