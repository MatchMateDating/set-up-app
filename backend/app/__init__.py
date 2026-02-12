# app/__init__.py

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import os
from .config import Config

# Load environment variables from .env file
load_dotenv()

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

    return app
