# Production image for the "loterias" stack (Dockhand git stack, build-on-deploy).
#
# One container: the Express backend serves /api AND the built React SPA, so the
# frontend's relative `/api` calls work without a reverse proxy in front.
#
# Debian slim (glibc) is used on purpose: better-sqlite3 publishes glibc
# prebuilds, and the native module compiled in the deps stage is ABI-compatible
# with the runtime stage because both use the same base image.

# ---------------------------------------------------------------- frontend ---
FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------ backend deps ---
FROM node:24-bookworm-slim AS backend-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY backend/package.json backend/package-lock.json ./
# devDependencies are required at runtime: the server is started through tsx
# (the tsconfig uses bundler resolution, whose emitted extensionless ESM
# specifiers plain `node` cannot resolve).
RUN npm ci

# ----------------------------------------------------------------- runtime ---
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/megasena.db \
    PUBLIC_DIR=/app/public

WORKDIR /app
COPY --from=backend-deps /build/node_modules ./node_modules
COPY backend/package.json backend/tsconfig.json ./
COPY backend/src ./src
COPY --from=frontend /build/dist ./public

# /data is the mount point for the SQLite database (bind-mounted from the host).
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/tsx", "src/index.ts"]
