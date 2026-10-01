# =========================================================================
# Multi-stage production build for NewMark Platform Ultra
# =========================================================================

# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install native compilation dependencies for cryptographic/db native bindings if needed
RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Build Vite client bundles and type check
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Create non-root system group and user
RUN addgroup --system --gid 1001 newmark && \
    adduser --system --uid 1001 newmark

# Copy production artifacts
COPY --chown=newmark:newmark package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=newmark:newmark --from=builder /usr/src/app/dist ./dist
COPY --chown=newmark:newmark --from=builder /usr/src/app/server.ts ./server.ts
COPY --chown=newmark:newmark --from=builder /usr/src/app/src ./src
COPY --chown=newmark:newmark --from=builder /usr/src/app/tsconfig.json ./tsconfig.json

# Switch to non-privileged user
USER newmark

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["npx", "tsx", "server.ts"]
