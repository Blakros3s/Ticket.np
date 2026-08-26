# syntax=docker/dockerfile:1.4
# ==============================================================================
# Next.js Frontend Dockerfile - Multi-stage build optimized for production
# Build context: frontend/ (see docker-compose)
# ==============================================================================

# ----------------------
# Base stage
# ----------------------
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

# ----------------------
# Dependencies stage
# ----------------------
FROM base AS deps

COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ----------------------
# Builder stage
# ----------------------
FROM base AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

RUN mkdir -p public

# ----------------------
# Production runner stage
# ----------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
