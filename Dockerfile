FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./

# Install from lockfile for reproducible and faster builds
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN npm ci --no-audit --no-fund --ignore-scripts

# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json  ./package.json
COPY . .

# Generate Prisma client (schema is at prisma/schema.prisma)
RUN set -eux; \
    for i in 1 2 3 4 5; do \
      npx prisma generate --schema=prisma/schema.prisma && exit 0; \
      echo "prisma generate failed (attempt ${i}), retrying..."; \
      sleep 3; \
    done; \
    echo "prisma generate failed after 5 attempts"; \
    exit 1

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma          ./prisma

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
