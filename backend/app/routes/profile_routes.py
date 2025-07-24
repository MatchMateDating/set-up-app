from flask import Blueprint, jsonify, request
from app.models.userDB import User
from functools import wraps
from app import db
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
    user_data = current_user.to_dict()

    if current_user.role == 'user' and not current_user.referral_code:
        current_user.referral_code = current_user.generate_referral_code()
        db.session.commit()
        user_data['referral_code'] = current_user.referral_code
    
    referrer_data = None
    if current_user.referred_by_id:
        referrer = User.query.get(current_user.referred_by_id)
        if referrer:
            referrer_data = referrer.to_dict()

    print(f"Current user info for profile: {user_data}")
    return jsonify({
        "user": user_data,
        "referrer": referrer_data})

@profile_bp.route('/update', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    if current_user.role == 'user':
        allowed_fields = ['name', 'bio', 'age', 'gender', 'height']
    elif current_user.role == 'matchmaker':
        allowed_fields = ['description']
    else:
        allowed_fields = []

    for field in allowed_fields:
        if field in data:
            setattr(current_user, field, data[field])

    db.session.commit()

    return jsonify(current_user.to_dict()), 200
