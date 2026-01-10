FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Build arguments для переменных окружения
ARG NEXT_PUBLIC_API_URL
ARG NODE_ENV

# Copy application code
COPY . .

# Создадим .env.local из build args (если файла нет)
# Next.js автоматически читает .env.local
RUN if [ ! -f .env.local ]; then \
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}" > .env.local && \
    echo "NODE_ENV=${NODE_ENV:-development}" >> .env.local; \
    fi

# Также установим как ENV для runtime
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=${NODE_ENV}

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev"]

