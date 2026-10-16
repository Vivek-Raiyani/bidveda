# ==============================================================================
# Stage 1: Install dependencies using Bun
# ==============================================================================
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy dependency specifications
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ==============================================================================
# Stage 2: Build the Next.js application
# ==============================================================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time argument for API Base URL
ARG NEXT_PUBLIC_API_URL=http://localhost:8002/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ==============================================================================
# Stage 3: Minimal Production Runner
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3003/ || exit 1

CMD ["node", "server.js"]
