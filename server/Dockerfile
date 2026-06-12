FROM oven/bun:1.2-alpine

WORKDIR /app

# Install dependencies (root workspace + server)
COPY package.json bun.lock package-lock.json* ./
COPY server/package.json ./server/
RUN bun install --production

# Shared code for next-bridge route handlers
COPY tsconfig.json ./
COPY server/ ./server/
COPY src/lib ./src/lib
COPY src/db ./src/db
COPY src/app/api ./src/app/api

WORKDIR /app/server

ENV API_PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
