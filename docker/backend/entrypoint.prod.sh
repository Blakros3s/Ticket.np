#!/bin/bash

# ==============================================================================
# Production Entrypoint Script for Django Backend
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $@"
}

log "Starting production entrypoint script..."

# Wait for database to be ready (with retries)
log "Waiting for database to be ready..."
until python manage.py check --database default 2>/dev/null; do
    log "Database is unavailable - sleeping"
    sleep 2
done
log "Database is ready!"

# Collect static files
log "Collecting static files..."
python manage.py collectstatic --noinput --clear || log "Warning: collectstatic failed"

# Run database migrations
log "Applying database migrations..."
python manage.py migrate --noinput

# Start the application server
# Using gunicorn for production
log "Starting Gunicorn server..."
python -m gunicorn --bind 0.0.0.0:8000 --workers 3 servicecenter.wsgi:application

#log "Starting Uvicorn server..."
#exec uvicorn backend.asgi:application \
#    --host 0.0.0.0 \
#    --port 8000 \
#    --workers ${UVICORN_WORKERS:-2} \
#    --timeout-keep-alive ${UVICORN_TIMEOUT:-30}