from .auth_routes import auth_bp
from .profile_routes import profile_bp
from .match_routes import match_bp
from .conversation_routes import conversation_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(profile_bp, url_prefix="/profile")
    app.register_blueprint(match_bp, url_prefix='/match')
    app.register_blueprint(conversation_bp, url_prefix='/conversation')
