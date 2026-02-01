#!/bin/bash
set -e

# Get PORT from environment, default to 5000
PORT=${PORT:-5000}

# Start Gunicorn
exec gunicorn -w 4 -b 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - run:app
