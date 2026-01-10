FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci || npm install

# Copy application code (включая frontend/.env.local)
COPY . .

# Next.js автоматически читает NEXT_PUBLIC_* из .env.local
# Убедитесь, что frontend/.env.local существует и содержит NEXT_PUBLIC_API_URL

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev"]

