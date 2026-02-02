#!/bin/bash
set -e

# Get PORT from environment, default to 5000
PORT=${PORT:-5000}

# Run database migrations
echo "Running database migrations..."
flask db upgrade || echo "Migration failed or already up to date"

# Start Gunicorn
echo "Starting Gunicorn on port $PORT..."
exec gunicorn -w 4 -b 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - run:app
