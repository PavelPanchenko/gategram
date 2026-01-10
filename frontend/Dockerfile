FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build arguments for Next.js public env vars
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev"]

