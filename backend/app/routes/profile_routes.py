from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app import db
import os
from werkzeug.utils import secure_filename
from app.models.imageDB import Image
from flask import current_app
from uuid import uuid4
from app.routes.shared import token_required, calculate_age

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/', methods=['GET'])
@token_required
def get_profile(current_user):
    user_data = current_user.to_dict()

    # if current_user.role == 'user' and not current_user.referral_code:
    #     current_user.referral_code = current_user.generate_referral_code()
    #     db.session.commit()
    #     user_data['referral_code'] = current_user.referral_code
    
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
        allowed_fields = ['name', 'bio', 'birthdate', 'gender', 'height', 'preferredAgeMin', 'preferredAgeMax', 'preferredGender']
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
                    current_user.age = calculate_age(current_user.birthdate)
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
