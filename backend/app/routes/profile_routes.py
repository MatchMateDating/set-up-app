from flask import Blueprint, jsonify, request
from app.models.userDB import User, ReferredUsers, PushToken
from app import db
import os
from werkzeug.utils import secure_filename
from app.models.imageDB import Image
from app.models.matchDB import Match
from app.models.messageDB import Message
from app.models.conversationDB import Conversation
from app.models.quizDB import QuizResult
from app.models.skipDB import UserSkip
from app.models.blockDB import UserBlock
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
        "user": user_data,
        "unit": user.unit,
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
                'imageLayout', 'match_radius', 'unit'
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

@profile_bp.route('/create_linked_dater', methods=['POST'])
@token_required
def create_linked_dater(current_user):
    """Create a dater account linked to the current matchmaker account"""
    try:
        if current_user.role != 'matchmaker':
            return jsonify({'error': 'Only matchmakers can create linked dater accounts'}), 403
        
        # Check if already has a linked dater account
        if current_user.linked_account_id:
            linked_account = User.query.get(current_user.linked_account_id)
            if linked_account and linked_account.role == 'user':
                return jsonify({'error': 'You already have a linked dater account'}), 400
        
        # Create new dater account with same email and password
        new_dater = User(
            email=current_user.email,
            first_name=current_user.first_name or '',
            last_name=current_user.last_name or '',
            role='user',
            referred_by_id=None
        )
        # Copy password hash (same password)
        new_dater.password_hash = current_user.password_hash
        new_dater.referral_code = new_dater.generate_referral_code()
        
        db.session.add(new_dater)
        db.session.flush()  # Get the ID
        
        # Link accounts bidirectionally
        current_user.linked_account_id = new_dater.id
        new_dater.linked_account_id = current_user.id
        
        # Set last_active_at for the new account being switched to
        new_dater.last_active_at = datetime.utcnow()
        
        db.session.commit()
        
        # Return a new token for the dater account so user is switched to dater context
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(new_dater.id))
        
        return jsonify({
            'message': 'Linked dater account created successfully',
            'user': new_dater.to_dict(),
            'token': token
        }), 201
        
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@profile_bp.route('/create_linked_matchmaker', methods=['POST'])
@token_required
def create_linked_matchmaker(current_user):
    """Create a matchmaker account linked to the current dater account"""
    try:
        if current_user.role != 'user':
            return jsonify({'error': 'Only daters can create linked matchmaker accounts'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        referral_code = data.get('referral_code')
        
        if not referral_code:
            return jsonify({'error': 'Referral code is required'}), 400
        
        # Find the referrer (the dater who provided the referral code - this is the dater the matchmaker will match for)
        referrer = User.query.filter_by(referral_code=referral_code).first()
        if not referrer:
            return jsonify({'error': 'Invalid referral code'}), 400
        
        # Ensure the referrer is a dater (user role)
        if referrer.role != 'user':
            return jsonify({'error': 'Referral code must be from a dater account'}), 400
        
        # Check if already has a linked matchmaker account
        if current_user.linked_account_id:
            linked_account = User.query.get(current_user.linked_account_id)
            if linked_account and linked_account.role == 'matchmaker':
                return jsonify({'error': 'You already have a linked matchmaker account'}), 400
        
        # Create new matchmaker account with same email and password
        new_matchmaker = User(
            email=current_user.email,
            first_name=current_user.first_name or '',
            last_name=current_user.last_name or '',
            role='matchmaker',
            referred_by_id=referrer.id
        )
        # Copy password hash (same password)
        new_matchmaker.password_hash = current_user.password_hash
        
        db.session.add(new_matchmaker)
        db.session.flush()  # Get the ID to ensure it's available and trigger after_insert event
        
        # The after_insert event should have created the ReferredUsers row, but we'll ensure it exists and is correct
        referral_row = ReferredUsers.query.filter_by(matchmaker_id=new_matchmaker.id).first()
        if not referral_row:
            referral_row = ReferredUsers(matchmaker_id=new_matchmaker.id)
            db.session.add(referral_row)
        
        # Set the linked_dater_1_id to the referrer (the dater who provided the referral code)
        # This is the dater the matchmaker will be matching for
        # Note: The after_insert event might have already set this, but we'll ensure it's correct
        referral_row.linked_dater_1_id = referrer.id
        
        # Link accounts bidirectionally
        current_user.linked_account_id = new_matchmaker.id
        new_matchmaker.linked_account_id = current_user.id
        
        # Set last_active_at for the new account being switched to
        new_matchmaker.last_active_at = datetime.utcnow()
        
        db.session.commit()
        
        # Verify the referred_by_id is set correctly (should be referrer.id, not current_user.id)
        # Refresh the object to ensure all relationships are loaded
        db.session.refresh(new_matchmaker)
        if new_matchmaker.referred_by_id != referrer.id:
            # This should never happen, but log it if it does
            print(f"WARNING: referred_by_id mismatch! Expected {referrer.id}, got {new_matchmaker.referred_by_id}")
        
        # Return a new token for the matchmaker account so user is switched to matchmaker context
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(new_matchmaker.id))
        
        return jsonify({
            'message': 'Linked matchmaker account created successfully',
            'user': new_matchmaker.to_dict(),
            'token': token
        }), 201
        
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@profile_bp.route('/switch_account', methods=['POST'])
@token_required
def switch_account(current_user):
    """Switch to the linked account (dater <-> matchmaker)"""
    try:
        if not current_user.linked_account_id:
            return jsonify({'error': 'No linked account found'}), 404
        
        linked_account = User.query.get(current_user.linked_account_id)
        if not linked_account:
            return jsonify({'error': 'Linked account not found'}), 404
        
        # Update last_active_at for the account being switched to
        linked_account.last_active_at = datetime.utcnow()
        db.session.commit()
        
        # Return the linked account's data and a new token
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(linked_account.id))
        
        return jsonify({
            'message': 'Account switched successfully',
            'user': linked_account.to_dict(),
            'token': token
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@profile_bp.route('/delete_account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    """
    Delete user account and all associated data (GDPR/CCPA Right to be Forgotten).
    No password required - user is already authenticated via JWT token.
    """
    try:
        # No password required - user is already authenticated via JWT token
        user_id = current_user.id
        
        # Delete all user-related data
        
        # 1. Delete matches where user is involved
        matches_as_user1 = Match.query.filter_by(user_id_1=user_id).all()
        matches_as_user2 = Match.query.filter_by(user_id_2=user_id).all()
        all_matches = matches_as_user1 + matches_as_user2
        
        for match in all_matches:
            # Delete conversations associated with matches
            conversations = Conversation.query.filter_by(match_id=match.id).all()
            for conversation in conversations:
                # Delete messages in conversations
                Message.query.filter_by(conversation_id=conversation.id).delete()
                db.session.delete(conversation)
            db.session.delete(match)
        
        # 2. Delete messages where user is sender or receiver (standalone messages)
        Message.query.filter(
            (Message.sender_id == user_id) | (Message.receiver_id == user_id)
        ).delete()
        
        # 3. Delete quiz results
        QuizResult.query.filter_by(user_id=user_id).delete()
        
        # 4. Delete user skips (where user skipped others or was skipped)
        UserSkip.query.filter(
            (UserSkip.user_id == user_id) | (UserSkip.skipped_user_id == user_id)
        ).delete()
        
        # 5. Delete user blocks (where user blocked others or was blocked)
        UserBlock.query.filter(
            (UserBlock.blocker_id == user_id) | (UserBlock.blocked_id == user_id)
        ).delete()
        
        # 6. Handle ReferredUsers (matchmaker relationships)
        if current_user.role == 'matchmaker':
            # Delete the ReferredUsers row if user is a matchmaker
            ReferredUsers.query.filter_by(matchmaker_id=user_id).delete()
        else:
            # If user is a linked dater, remove them from matchmaker's ReferredUsers
            referral_rows = ReferredUsers.query.filter(
                (ReferredUsers.linked_dater_1_id == user_id) |
                (ReferredUsers.linked_dater_2_id == user_id) |
                (ReferredUsers.linked_dater_3_id == user_id) |
                (ReferredUsers.linked_dater_4_id == user_id) |
                (ReferredUsers.linked_dater_5_id == user_id) |
                (ReferredUsers.linked_dater_6_id == user_id) |
                (ReferredUsers.linked_dater_7_id == user_id) |
                (ReferredUsers.linked_dater_8_id == user_id) |
                (ReferredUsers.linked_dater_9_id == user_id) |
                (ReferredUsers.linked_dater_10_id == user_id)
            ).all()
            
            for ref_row in referral_rows:
                # Clear the linked dater field that matches this user
                for i in range(1, 11):
                    field_name = f'linked_dater_{i}_id'
                    if getattr(ref_row, field_name) == user_id:
                        setattr(ref_row, field_name, None)
        
        # 7. Handle linked accounts
        if current_user.linked_account_id:
            linked_account = User.query.get(current_user.linked_account_id)
            if linked_account:
                linked_account.linked_account_id = None
        
        # Clear linked_account_id from any user that links to this user
        linked_users = User.query.filter_by(linked_account_id=user_id).all()
        for linked_user in linked_users:
            linked_user.linked_account_id = None
        
        # 8. Clear referred_by_id from any users this user referred
        referred_users = User.query.filter_by(referred_by_id=user_id).all()
        for referred_user in referred_users:
            referred_user.referred_by_id = None
        
        # 9. Images and PushTokens will be automatically deleted via cascade='all, delete-orphan'
        # But we can explicitly delete them for clarity
        Image.query.filter_by(user_id=user_id).delete()
        PushToken.query.filter_by(user_id=user_id).delete()
        
        # 10. Finally, delete the user account itself
        db.session.delete(current_user)
        db.session.commit()
        
        return jsonify({
            'message': 'Account and all associated data deleted successfully'
        }), 200
        
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error during account deletion',
            'details': str(e)
        }), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500
