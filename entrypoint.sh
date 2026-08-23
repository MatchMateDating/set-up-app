#!/bin/bash
set -e

# Get PORT from environment, default to 5000
PORT=${PORT:-5000}

# Set FLASK_APP if not already set (for migration commands)
export FLASK_APP=${FLASK_APP:-app:create_app}

# Run database migrations
echo "Running database migrations..."

# Initialize migrations if they don't exist
if [ ! -d "migrations" ]; then
    echo "Initializing database migrations..."
    flask db init || echo "Migration init failed or already exists"
fi

# Create initial migration if no migration files exist
if [ ! -d "migrations/versions" ] || [ -z "$(ls -A migrations/versions/*.py 2>/dev/null)" ]; then
    echo "Creating initial migration..."
    flask db migrate -m "Initial migration" || echo "Migration creation failed or already exists"
fi

# Apply migrations
echo "Applying database migrations..."
flask db upgrade || echo "Migration upgrade failed or already up to date"

# Web Push subscriptions exceed VARCHAR(255); widen column if still limited
echo "Ensuring push_tokens.token is TEXT..."
python - <<'PY' || echo "push_tokens.token widen skipped"
import os
uri = os.environ.get("DATABASE_URL") or ""
if not uri.strip() or uri.startswith("sqlite"):
    raise SystemExit(0)
uri = uri.replace("postgres://", "postgresql://", 1)
try:
    import psycopg
    conn = psycopg.connect(uri)
except Exception:
    import psycopg2
    conn = psycopg2.connect(uri)
cur = conn.cursor()
cur.execute("ALTER TABLE push_tokens ALTER COLUMN token TYPE TEXT")
conn.commit()
cur.close()
conn.close()
print("push_tokens.token is TEXT")
PY

# Start Gunicorn
echo "Starting Gunicorn on port $PORT..."
exec gunicorn -w 4 -b 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - run:app
