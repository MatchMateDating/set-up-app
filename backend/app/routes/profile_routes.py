from flask import Blueprint, jsonify, request
from app.models.userDB import User
from functools import wraps
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

profile_bp = Blueprint('profile', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        print("Headers received:", dict(request.headers))  # Debug: print headers
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            print("JWT identity:", user_id)  # Debug: print identity
            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({'message': 'User not found!'}), 404
        except Exception as e:
            print("JWT error:", str(e))  # Debug: print error
            return jsonify({'message': f'Token error: {str(e)}'}), 403

        return f(current_user, *args, **kwargs)
    return decorated

@profile_bp.route('/', methods=['GET'])
@token_required
def get_profile(current_user):
    print(f"Current user info for profile: {current_user.to_dict()}")
    return jsonify(current_user.to_dict())