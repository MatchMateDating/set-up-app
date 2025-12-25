from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app import db
import os
from werkzeug.utils import secure_filename
from app.models.imageDB import Image
from flask import current_app
from uuid import uuid4
from app.routes.shared import token_required, calculate_age
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime


profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/', methods=['GET'])
@token_required
def get_profile(current_user):
    user_data = current_user.to_dict()
    
    referrer_data = None
    if current_user.referred_by_id:
        referrer = User.query.get(current_user.referred_by_id)
        if referrer:
            referrer_data = referrer.to_dict()

    # print(f"Current user info for profile: {user_data}")
    return jsonify({
        "user": user_data,
        "referrer": referrer_data})

@profile_bp.route('/<int:user_id>', methods=['GET'])
@token_required
def get_user_basic_profile(current_user, user_id):
    # Anyone logged in can request this
    user = User.query.get(user_id)
    user_data = user.to_dict()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Only return lightweight info (avoid exposing private fields)
    return jsonify({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "birthdate": user.birthdate,
        "role": user.role,
        "user": user_data
    }), 200

@profile_bp.route('/update', methods=['PUT'])
@token_required
def update_profile(current_user):
    try:
        data = request.get_json()
        print('error:', data)
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400

        if current_user.role == 'user':
            allowed_fields = [
                'first_name', 'last_name', 'bio', 'birthdate', 'gender',
                'height', 'preferredAgeMin', 'preferredAgeMax',
                'preferredGenders', 'fontFamily', 'profileStyle',
                'imageLayout', 'match_radius'
            ]
        else:
            return jsonify({'error': 'You are not allowed to update this profile'}), 403

        for field in allowed_fields:
            if field not in data:
                continue

            value = data[field]

            if field == 'birthdate':
                try:
                    birthdate = datetime.strptime(value, '%Y-%m-%d').date()
                    current_user.birthdate = birthdate
                    current_user.age = calculate_age(birthdate)
                except (ValueError, TypeError):
                    return jsonify({
                        'error': 'Invalid birthdate format. Use YYYY-MM-DD'
                    }), 400

            elif field in ['preferredAgeMin', 'preferredAgeMax', 'match_radius']:
                if not isinstance(value, (int, float)):
                    return jsonify({
                        'error': f'{field} must be a number'
                    }), 400
                setattr(current_user, field, value)

            else:
                setattr(current_user, field, value)

        db.session.commit()

        return jsonify(current_user.to_dict()), 200

    except SQLAlchemyError as e:
        print('here db')
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500

    except Exception as e:
        print('here server')
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

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

@profile_bp.route('/user/<int:user_id>/avatar', methods=['PATCH'])
def update_avatar(user_id):
    print("Received request to update avatar")
    data = request.get_json()
    avatar = data.get('avatar')

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.avatar = avatar
    db.session.commit()

    return jsonify({"message": "Avatar updated", "avatar": user.avatar})

