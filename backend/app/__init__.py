# app/__init__.py

from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before Config: class-level settings are read at import time.
_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env", override=True)

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
import logging
import os
import sys
from .config import Config

# Unset empty environment variables to allow defaults to be used
# This prevents empty strings from overriding default values in config
if os.getenv("AWS_PROFILE") == "":
    os.environ.pop("AWS_PROFILE", None)
if os.getenv("SECRET_KEY") == "":
    os.environ.pop("SECRET_KEY", None)
if os.getenv("JWT_SECRET_KEY") == "":
    os.environ.pop("JWT_SECRET_KEY", None)

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
migrate = Migrate()


def _ensure_push_tokens_token_is_text(app):
    """
    Web Push subscription JSON is longer than VARCHAR(255).
    Older DBs may still have varchar; widen to TEXT (idempotent on Postgres).
    """
    uri = (app.config.get("SQLALCHEMY_DATABASE_URI") or "").lower()
    if "sqlite" in uri:
        return
    try:
        from sqlalchemy import text

        with app.app_context():
            db.session.execute(
                text("ALTER TABLE push_tokens ALTER COLUMN token TYPE TEXT")
            )
            db.session.commit()
            app.logger.info("Ensured push_tokens.token is TEXT")
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        app.logger.warning("push_tokens.token TEXT ensure skipped: %s", e)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow Authorization and Content-Type headers, and all common methods
    # Use CORS_ORIGINS from config if set, otherwise allow all origins
    cors_origins = app.config.get('CORS_ORIGINS', ['*'])
    CORS(
        app,
        supports_credentials=True,
        resources={r"/*": {"origins": cors_origins}},
        expose_headers=["Authorization"],
        allow_headers=["Authorization", "Content-Type"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    )
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    from .routes import register_blueprints
    register_blueprints(app)

    from .services import ai_embeddings_cli
    ai_embeddings_cli.register_commands(app)

    # INFO logs from app.services (e.g. message push flow) are otherwise hidden (root defaults to WARNING).
    if app.debug or os.getenv("FLASK_ENV", "development") == "development":
        svc = logging.getLogger("app.services")
        svc.setLevel(logging.INFO)
        if not svc.handlers:
            ch = logging.StreamHandler(sys.stderr)
            ch.setLevel(logging.INFO)
            ch.setFormatter(
                logging.Formatter("%(levelname)s [%(name)s] %(message)s")
            )
            svc.addHandler(ch)

    # Schema patches that don't rely on alembic migration history being present locally
    _ensure_push_tokens_token_is_text(app)

    return app
