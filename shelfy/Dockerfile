ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

# Install Node.js and build tools.
# python3 / make / g++ are required by node-gyp to compile better-sqlite3 from source
# (Alpine uses musl libc, so prebuilt binaries are not used).
RUN apk add --no-cache nodejs npm python3 make g++

WORKDIR /app

# --- dependency install (layer-cached separately from source) ---

COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --omit=dev

COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci

# --- source & build ---

COPY backend/ backend/
COPY frontend/ frontend/

# Build the React frontend.
# VITE_PUBLIC_BASE_URL is intentionally left unset so QR codes fall back to
# window.location.origin at runtime — the correct behaviour for HA networking.
RUN cd frontend && npm run build

# Frontend node_modules are only needed for the build; strip them now.
RUN rm -rf frontend/node_modules

# --- startup ---

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]
