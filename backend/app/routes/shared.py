from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from functools import wraps
from app.models.userDB import User
from datetime import date

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Verify the JWT token
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            
            if not user_id:
                return jsonify({'message': 'Invalid token: no user identity'}), 401
            
            # Get current user
            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({'message': 'User not found'}), 404
                
            # Check if user is still active/enabled
            if not getattr(current_user, 'is_active', True):
                return jsonify({'message': 'Account deactivated'}), 403
                
            return f(current_user, *args, **kwargs)
            
        except ExpiredSignatureError:
            return jsonify({
                'message': 'Token has expired',
                'error_code': 'TOKEN_EXPIRED',
                'refresh_required': True
            }), 401
            
        except InvalidTokenError as e:
            return jsonify({
                'message': f'Invalid token: {str(e)}',
                'error_code': 'INVALID_TOKEN'
            }), 401
            
        except Exception as e:
            print(f"Unexpected JWT error: {str(e)}")
            return jsonify({
                'message': 'Authentication failed',
                'error_code': 'AUTH_ERROR'
            }), 401
            
    return decorated

def calculate_age(birthdate: date) -> int:
    today = date.today()
    age = today.year - birthdate.year - (
        (today.month, today.day) < (birthdate.month, birthdate.day)
    )
    return age