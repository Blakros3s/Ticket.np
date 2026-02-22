# syntax=docker/dockerfile:1.4
# ==============================================================================
# Next.js Frontend Dockerfile - Multi-stage build optimized for production
# ==============================================================================

# ----------------------
# Base stage
# ----------------------
FROM node:20-alpine AS base

# Install dependencies only when needed
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ----------------------
# Dependencies stage
# ----------------------
FROM base AS deps

# Copy dependency files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ----------------------
# Builder stage
# ----------------------
FROM base AS builder

WORKDIR /app

# Build-time environment variables for Next.js client-side
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY frontend/ .

# Build Next.js app with cache mount for .next directory
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Ensure public directory exists (even if empty) for the runner stage
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

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# Standalone output is enabled in next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the standalone Next.js server
CMD ["node", "server.js"]
