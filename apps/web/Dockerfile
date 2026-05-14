FROM node:20-alpine AS base

# ── deps ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/shared/package.json packages/shared/

RUN npm ci --ignore-scripts

# ── build ─────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY apps/web/ apps/web/
COPY packages/ packages/
COPY turbo.json tsconfig*.json ./

WORKDIR /app/apps/web
RUN npm run build

# ── runtime ───────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone output in a monorepo preserves the full path
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
