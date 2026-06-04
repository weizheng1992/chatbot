# Multi-stage build for optimal image size and caching
FROM node:22-alpine AS base

# Install pnpm and system dependencies
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Stage 1: Install dependencies based on lockfile
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Running build will compile the Next.js app to .next
RUN pnpm build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy built application and migrations
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder /app/lib/db/migrate.ts ./lib/db/migrate.ts

# Install ONLY production dependencies to keep the image small
# Note: We need tsx to run typescript migration file (lib/db/migrate.ts) on startup.
RUN pnpm install --prod --frozen-lockfile && pnpm add -D tsx

EXPOSE 3000

# Script to run migrations and start the server
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]
