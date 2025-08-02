from flask import Blueprint, jsonify, request
from app.models.userDB import User
from functools import wraps
from app import db
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
import os
from werkzeug.utils import secure_filename
from app.models.imageDB import Image
from flask import current_app
from uuid import uuid4
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

profile_bp = Blueprint('profile', __name__)

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

    # print(f"Current user info for profile: {user_data}")
    return jsonify({
        "user": user_data,
        "referrer": referrer_data})

@profile_bp.route('/update', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    if current_user.role == 'user':
        allowed_fields = ['name', 'bio', 'birthdate', 'gender', 'height']
    elif current_user.role == 'matchmaker':
        allowed_fields = ['description']
    else:
        allowed_fields = []

    for field in allowed_fields:
        if field in data:
            if field == 'birthdate':
                from datetime import datetime
                try:
                    current_user.birthdate = datetime.strptime(data['birthdate'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'msg': 'Invalid birthdate format'}), 400
            else:
                setattr(current_user, field, data[field])

    db.session.commit()

    return jsonify(current_user.to_dict()), 200

@profile_bp.route('/upload_image', methods=['POST'])
@token_required
def upload_image(current_user):
    if 'image' not in request.files:
        return jsonify({'message': 'No image file provided'}), 400
    
    image_file = request.files['image']
    if image_file.filename == '':
        return jsonify({'message': 'No selected file'}), 400

    # Generate a unique filename
    ext = os.path.splitext(secure_filename(image_file.filename))[1]
    unique_filename = f"{uuid4().hex}{ext}"

    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, unique_filename)
    image_file.save(file_path)

    image_url = f'/static/uploads/{unique_filename}'
    new_image = Image(user_id=current_user.id, image_url=image_url)
    db.session.add(new_image)
    db.session.commit()

    return jsonify(new_image.to_dict()), 201

@profile_bp.route('/delete_image/<int:image_id>', methods=['DELETE'])
@token_required
def delete_image(current_user, image_id):
    image = Image.query.filter_by(id=image_id, user_id=current_user.id).first()
    if not image:
        return jsonify({'message': 'Image not found or unauthorized'}), 404

    # Optional: Delete file from filesystem (if desired)
    try:
        file_path = os.path.join(current_app.root_path, image.image_url.lstrip('/'))
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"Error deleting file from filesystem: {e}")

    db.session.delete(image)
    db.session.commit()

    return jsonify({'message': 'Image deleted successfully'}), 200
