#!/usr/bin/with-contenv bashio

# Store the SQLite database in /data — Home Assistant mounts this directory
# as a persistent volume that survives add-on updates and container restarts.
export DATABASE_PATH="/data/shelfy.db"

export PORT=43127

bashio::log.info "Starting Shelfy on port ${PORT} (database: ${DATABASE_PATH})..."

exec node /app/backend/server.js
