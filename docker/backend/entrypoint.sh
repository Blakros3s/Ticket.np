#!/bin/bash

# ==============================================================================
# Development Entrypoint Script for Django Backend
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $@"
}

log "Starting development entrypoint script..."

# Wait for database to be ready (with retries)
log "Waiting for database to be ready..."
until python manage.py check --database default; do
    log "Database is unavailable - sleeping"
    sleep 2
done

log "Database is ready!"

# Run database migrations (dev only - no static collection for faster startup)
log "Applying database migrations..."
python manage.py migrate --noinput

log "Starting development server..."
exec "$@"