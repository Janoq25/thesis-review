FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# ── deps ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/shared/package.json packages/shared/

RUN npm ci

# ── generate prisma client ────────────────────────────
FROM deps AS prisma
WORKDIR /app

COPY packages/database/schema.prisma packages/database/
RUN npx prisma generate --schema=packages/database/schema.prisma

# ── build ─────────────────────────────────────────────
FROM prisma AS build
WORKDIR /app

COPY apps/api/ apps/api/
COPY packages/ packages/
COPY turbo.json tsconfig*.json ./

WORKDIR /app/apps/api
RUN npx nest build

# ── runtime ───────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/database/schema.prisma ./packages/database/schema.prisma

EXPOSE 3001
CMD ["node", "dist/main.js"]
