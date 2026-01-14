.PHONY: help run db-init db-migrate db-upgrade db-reset setup install venv activate

# Virtual environment path
VENV = venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

# Default target
help:
	@echo "Available targets:"
	@echo "  make venv         - Create virtual environment"
	@echo "  make activate     - Activate virtual environment (opens interactive shell)"
	@echo "  make run          - Run Flask app (python -m flask run --host=0.0.0.0 --port=5000)"
	@echo "  make db-init      - Initialize database (flask db init)"
	@echo "  make db-migrate   - Create database migration (flask db migrate)"
	@echo "  make db-upgrade   - Apply database migrations (flask db upgrade)"
	@echo "  make db-reset     - Reset database (delete instance and migrations, then reinitialize)"
	@echo "  make setup        - Full setup (create venv, install requirements, init db, migrate, upgrade)"
	@echo "  make install      - Install Python requirements"

# Create virtual environment
venv:
	@echo "Creating virtual environment..."
	@if [ ! -d "$(VENV)" ]; then \
		python3 -m venv $(VENV); \
		echo "Virtual environment created!"; \
	else \
		echo "Virtual environment already exists."; \
	fi

# Activate virtual environment (opens interactive shell)
activate: venv
	@echo "Activating virtual environment..."
	@echo "Type 'exit' to leave the activated shell."
	@bash -c "source $(VENV)/bin/activate && exec bash"

# Run Flask app
run: venv
	@echo "Starting Flask app..."
	$(PYTHON) -m flask run --host=0.0.0.0 --port=5000

# Initialize database
db-init: venv
	@echo "Initializing database..."
	$(PYTHON) -m flask db init

# Create migration
db-migrate: venv
	@echo "Creating database migration..."
	$(PYTHON) -m flask db migrate -m "Auto migration"

# Apply migrations
db-upgrade: venv
	@echo "Applying database migrations..."
	$(PYTHON) -m flask db upgrade

# Reset database (delete instance and migrations folders, then reinitialize)
db-reset:
	@echo "Resetting database..."
	@if [ -d "instance" ]; then rm -rf instance; fi
	@if [ -d "migrations" ]; then rm -rf migrations; fi
	@echo "Database folders deleted. Run 'make setup' to reinitialize."

# Full database setup (init, migrate, upgrade)
db-setup: db-init db-migrate db-upgrade
	@echo "Database setup complete!"

# Install requirements
install: venv
	@echo "Installing Python requirements..."
	$(PIP) install -r requirements.txt

# Full setup: create venv, install requirements and setup database
setup: venv install db-setup
	@echo "Setup complete! Run 'make run' to start the Flask app."

