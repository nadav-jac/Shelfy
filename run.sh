#!/usr/bin/with-contenv bashio

# Store the SQLite database in /data — Home Assistant mounts this directory
# as a persistent volume that survives add-on updates and container restarts.
export DATABASE_PATH="/data/shelfy.db"

export PORT=43127

# Base URL embedded in QR codes. Must be reachable without HA authentication
# (i.e. direct port, not the ingress path) so phones can scan them without
# being logged into Home Assistant.
export QR_BASE_URL=$(bashio::config 'qr_base_url')

bashio::log.info "Starting Shelfy on port ${PORT} (database: ${DATABASE_PATH}, QR base: ${QR_BASE_URL})..."

exec node /app/backend/server.js
