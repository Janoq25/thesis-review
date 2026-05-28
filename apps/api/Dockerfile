FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# ── deps ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json             apps/api/
COPY packages/database/package.json   packages/database/
COPY packages/ai-engine/package.json  packages/ai-engine/
COPY packages/shared/package.json     packages/shared/

RUN npm ci

# ── generate prisma client ────────────────────────────
FROM deps AS prisma
WORKDIR /app

COPY packages/database/schema.prisma packages/database/
RUN npx prisma generate --schema=packages/database/schema.prisma

# ── build ─────────────────────────────────────────────
FROM prisma AS build
WORKDIR /app

COPY apps/api/     apps/api/
COPY packages/     packages/
COPY turbo.json    ./

# 1) Compile the internal ai-engine package first
# Use the workspace-level tsc binary (npx tsc would download a fake tsc@2.0.4)
WORKDIR /app/packages/ai-engine
RUN /app/node_modules/.bin/tsc

# 2) Build the NestJS API (ai-engine dist is now resolvable via workspace symlink)
WORKDIR /app/apps/api
RUN /app/node_modules/.bin/nest build

# 3) Fail loudly if the build didn't produce dist/main.js
RUN test -f /app/apps/api/dist/main.js || (echo "ERROR: nest build did not produce dist/main.js" && exit 1)

# ── runtime ───────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace node_modules (includes symlinks to packages/*)
COPY --from=build /app/node_modules    ./node_modules
# Copy compiled internal packages (ai-engine dist, prisma client, etc.)
COPY --from=build /app/packages        ./packages
# Copy compiled API output
COPY --from=build /app/apps/api/dist   ./dist
# Copy API's own package.json so Node can resolve its module root
COPY --from=build /app/apps/api/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/main.js"]
