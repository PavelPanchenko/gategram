FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (исправляем проблему с lockfile)
RUN npm ci || npm install

# Build arguments для переменных окружения (опциональные, для переопределения)
ARG NEXT_PUBLIC_API_URL=
ARG NODE_ENV=development

# Copy application code (включая .env.local если он существует)
COPY . .

# Приоритет: 1) build arg (если передан), 2) .env.local (если существует), 3) дефолт
RUN if [ ! -f .env.local ]; then \
    # .env.local не существует - создаем из build args или дефолтов
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}" > .env.local && \
    echo "NODE_ENV=${NODE_ENV}" >> .env.local; \
    elif [ -f .env.local ] && [ -n "${NEXT_PUBLIC_API_URL}" ]; then \
    # .env.local существует, но передан build arg - обновляем значение
    if grep -q "^NEXT_PUBLIC_API_URL=" .env.local; then \
      sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}|" .env.local; \
    else \
      echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" >> .env.local; \
    fi; \
    fi
    # Если .env.local существует и build arg не передан - оставляем как есть (Next.js прочитает)

# Next.js автоматически читает NEXT_PUBLIC_* из .env.local во время сборки
# ENV устанавливаем для совместимости
ENV NODE_ENV=${NODE_ENV}

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev"]

