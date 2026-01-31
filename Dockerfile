# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app:create_app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from backend directory
COPY backend/ .

# Create instance directory for SQLite (if used in development)
RUN mkdir -p instance

# Expose port (default 5000, but can be overridden by PORT env var)
EXPOSE 5000

# Run migrations and start server
# Note: Railway will run migrations automatically or you can run them manually
# Use exec form with sh -c to properly expand PORT variable
CMD ["sh", "-c", "gunicorn -w 4 -b 0.0.0.0:${PORT:-5000} --timeout 120 --access-logfile - --error-logfile - run:app"]
