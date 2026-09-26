# syntax=docker/dockerfile:1
#
# Pharm-LIT — one image that serves the API *and* the Expo web build.
# Works on Fly.io, Railway, Google Cloud Run, Coolify, Dokku or any VPS.
#
#   docker build -t pharm-lit .
#   docker run -p 4000:4000 -v pharmlit_data:/data \
#     -e JWT_SECRET=$(openssl rand -base64 48) \
#     -e PAYSTACK_SECRET_KEY=sk_test_xxx pharm-lit

# ---------- stage 1: export the web app ----------
FROM node:22-bookworm-slim AS web
WORKDIR /build
COPY mobile/package.json mobile/package-lock.json ./mobile/
RUN npm --prefix mobile ci
COPY mobile ./mobile
RUN npm --prefix mobile run build:web

# ---------- stage 2: runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev && npm cache clean --force

COPY backend/src ./backend/src
# config.js resolves webDir as <backend>/../mobile/dist, so keep this layout.
COPY --from=web /build/mobile/dist ./mobile/dist

# Persist these two directories with a volume, or the database and every
# uploaded prescription disappear when the container is replaced.
ENV PORT=4000 \
    DATA_DIR=/data/data \
    UPLOADS_DIR=/data/uploads
RUN mkdir -p /data/data /data/uploads
VOLUME ["/data"]

EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
