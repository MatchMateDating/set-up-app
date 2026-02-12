from .auth_routes import auth_bp
from .profile_routes import profile_bp
from .match_routes import match_bp
from .conversation_routes import conversation_bp
from .invite_routes import invite_bp
from .quiz_routes import quiz_bp
from .referral_routes import referral_bp
from .location_routes import location_bp
from .notification_routes import notification_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(profile_bp, url_prefix="/profile")
    app.register_blueprint(match_bp, url_prefix='/match')
    app.register_blueprint(conversation_bp, url_prefix='/conversation')
    app.register_blueprint(invite_bp, url_prefix='/invite')
    app.register_blueprint(quiz_bp, url_prefix='/quiz')
    app.register_blueprint(referral_bp, url_prefix='/referral')
    app.register_blueprint(location_bp, url_prefix='/location')
    app.register_blueprint(notification_bp, url_prefix='/notifications')