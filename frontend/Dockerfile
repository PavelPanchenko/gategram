FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# NEXT_PUBLIC_* встраиваются в клиентский бандл на этапе сборки
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_SSR
ARG NEXT_PUBLIC_API_PORT=8001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL_SSR=$NEXT_PUBLIC_API_URL_SSR
ENV NEXT_PUBLIC_API_PORT=$NEXT_PUBLIC_API_PORT
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]
