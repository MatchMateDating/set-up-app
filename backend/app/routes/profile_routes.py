from flask import Blueprint, jsonify, request
from app.models.userDB import User, ReferredUsers, PushToken
from app import db
import os
from werkzeug.utils import secure_filename
from app.models.imageDB import Image
from app.models.matchDB import Match
from app.models.messageDB import Message
from app.models.conversationDB import Conversation
from app.models.conversationReadStateDB import ConversationReadState
from app.models.quizDB import QuizResult
from app.models.skipDB import UserSkip
from app.models.blockDB import UserBlock
from flask import current_app
from uuid import uuid4
from uuid import uuid4
from app.routes.shared import token_required, calculate_age
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from app.services.storage_service import (
    upload_image_to_cloud,
    delete_image_from_cloud,
    extract_key_from_url
)
from app.routes.auth_routes import send_verification_email, is_email


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
                'imageLayout', 'match_radius', 'unit', 'profile_completion_step',
                'show_location'
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

            elif field in ['preferredAgeMin', 'preferredAgeMax', 'match_radius', 'profile_completion_step']:
                if field == 'profile_completion_step':
                    # Allow None, 1, 2, or 3
                    if value is not None and value not in [1, 2, 3]:
                        return jsonify({
                            'error': f'{field} must be 1, 2, 3, or null'
                        }), 400
                    setattr(current_user, field, value)
                elif not isinstance(value, (int, float)):
                    return jsonify({
                        'error': f'{field} must be a number'
                    }), 400
                else:
                    setattr(current_user, field, value)

            elif field == 'show_location':
                current_user.show_location = bool(value)

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


@profile_bp.route('/request_email_change', methods=['POST'])
@token_required
def request_email_change(current_user):
    try:
        data = request.get_json() or {}
        new_email = (data.get('new_email') or '').strip().lower()

        if not new_email:
            return jsonify({'error': 'new_email is required'}), 400

        if not is_email(new_email):
            return jsonify({'error': 'Please enter a valid email'}), 400

        current_email = (current_user.email or '').strip().lower()
        if new_email == current_email:
            return jsonify({'error': 'New email must be different from current email'}), 400

        linked_account = User.query.get(current_user.linked_account_id) if current_user.linked_account_id else None
        allowed_ids = {current_user.id}
        if linked_account:
            allowed_ids.add(linked_account.id)

        existing_users = User.query.filter_by(email=new_email).all()
        conflicting_user = next((u for u in existing_users if u.id not in allowed_ids), None)
        if conflicting_user:
            return jsonify({'error': 'Email is already in use'}), 400

        verification_token = current_user.generate_verification_token()
        current_user.email_verification_token = verification_token
        db.session.commit()

        verification_sent = send_verification_email(
            new_email,
            verification_token,
            current_user.first_name
        )

        if not verification_sent:
            return jsonify({'error': 'Failed to send verification email'}), 500

        return jsonify({
            'message': 'Verification code sent to your new email',
            'verification_sent': True
        }), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500


@profile_bp.route('/verify_email_change', methods=['POST'])
@token_required
def verify_email_change(current_user):
    try:
        data = request.get_json() or {}
        new_email = (data.get('new_email') or '').strip().lower()
        code = (data.get('code') or '').strip()

        if not new_email or not code:
            return jsonify({'error': 'new_email and code are required'}), 400

        if not is_email(new_email):
            return jsonify({'error': 'Please enter a valid email'}), 400

        if not current_user.email_verification_token:
            return jsonify({'error': 'No pending email verification request'}), 400

        if code != current_user.email_verification_token:
            return jsonify({'error': 'Invalid verification code'}), 400

        linked_account = User.query.get(current_user.linked_account_id) if current_user.linked_account_id else None
        allowed_ids = {current_user.id}
        if linked_account:
            allowed_ids.add(linked_account.id)

        existing_users = User.query.filter_by(email=new_email).all()
        conflicting_user = next((u for u in existing_users if u.id not in allowed_ids), None)
        if conflicting_user:
            return jsonify({'error': 'Email is already in use'}), 400

        current_user.email = new_email
        current_user.email_verified = True
        current_user.email_verification_token = None

        if linked_account:
            linked_account.email = new_email
            linked_account.email_verified = True
            linked_account.email_verification_token = None

        db.session.commit()
        return jsonify({
            'message': 'Email updated successfully',
            'user': current_user.to_dict()
        }), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500


@profile_bp.route('/change_password', methods=['PUT'])
@token_required
def change_password(current_user):
    try:
        data = request.get_json() or {}
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not old_password or not new_password:
            return jsonify({'error': 'old_password and new_password are required'}), 400

        if not current_user.check_password(old_password):
            return jsonify({'error': 'Current password is incorrect'}), 400

        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters long'}), 400

        current_user.set_password(new_password)

        linked_account = User.query.get(current_user.linked_account_id) if current_user.linked_account_id else None
        if linked_account:
            linked_account.set_password(new_password)

        db.session.commit()
        return jsonify({'message': 'Password updated successfully'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Database error',
            'details': str(e)
        }), 500
    except Exception as e:
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

    # Try cloud storage first, fall back to local if not configured
    use_cloud_storage = current_app.config.get('USE_CLOUD_STORAGE', False)
    
    if use_cloud_storage:
        # Upload to cloud storage (S3 or R2)
        image_url, storage_key = upload_image_to_cloud(image_file, current_user.id)
        
        if not image_url:
            return jsonify({'message': 'Failed to upload image to cloud storage'}), 500
        
        # Store the full URL in database
        new_image = Image(user_id=current_user.id, image_url=image_url)
        db.session.add(new_image)
        db.session.commit()
        
        return jsonify(new_image.to_dict()), 201
    else:
        # Fall back to local filesystem storage
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

    # Delete from cloud storage if configured
    use_cloud_storage = current_app.config.get('USE_CLOUD_STORAGE', False)
    
    if use_cloud_storage:
        # Extract storage key from URL and delete from cloud
        storage_key = extract_key_from_url(image.image_url)
        if storage_key:
            delete_image_from_cloud(storage_key)
    else:
        # Delete from local filesystem
        try:
            file_path = os.path.join(current_app.root_path, image.image_url.lstrip('/'))
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            current_app.logger.error(f"Error deleting file from filesystem: {e}")

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
            phone_number=current_user.phone_number,
            role='user',
            first_name=current_user.first_name or None,
            last_name=current_user.last_name or None,
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
        
        referral_code = (data.get('referral_code') or '').strip()
        
        if not referral_code:
            return jsonify({'error': 'Referral code is required'}), 400
        
        # Find the referrer (the dater who provided the referral code - this is the dater the matchmaker will match for)
        referrer = User.query.filter_by(referral_code=referral_code).first()
        if not referrer:
            return jsonify({'error': 'Invalid referral code'}), 400
        
        # Ensure the referrer is a dater (user role)
        if referrer.role != 'user':
            return jsonify({'error': 'Referral code must be from a dater account'}), 400

        # Prevent self-referrals when creating a linked matchmaker account.
        if referrer.id == current_user.id:
            return jsonify({'error': 'You cannot use your own referral code'}), 400
        
        # Check if already has a linked matchmaker account
        if current_user.linked_account_id:
            linked_account = User.query.get(current_user.linked_account_id)
            if linked_account and linked_account.role == 'matchmaker':
                return jsonify({'error': 'You already have a linked matchmaker account'}), 400
        
        # Create new matchmaker account with same email and password
        new_matchmaker = User(
            email=current_user.email,
            phone_number=current_user.phone_number,
            role='matchmaker',
            first_name=current_user.first_name or None,
            last_name=current_user.last_name or None,
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


def _delete_user_related_data(user):
    """Delete user data dependencies before removing the user row."""
    user_id = user.id

    # 1. Delete matches where user is involved + related conversations/messages
    matches_as_user1 = Match.query.filter_by(user_id_1=user_id).all()
    matches_as_user2 = Match.query.filter_by(user_id_2=user_id).all()
    all_matches = matches_as_user1 + matches_as_user2
    for match in all_matches:
        conversations = Conversation.query.filter_by(match_id=match.id).all()
        for conversation in conversations:
            ConversationReadState.query.filter_by(
                conversation_id=conversation.id
            ).delete()
            Message.query.filter_by(conversation_id=conversation.id).delete()
            db.session.delete(conversation)
        db.session.delete(match)

    ConversationReadState.query.filter_by(viewer_user_id=user_id).delete()

    # 2. Delete standalone/direct messages (any row where this user is sender or receiver)
    # Clear last_read_message_id first so other users' read state does not reference
    # message ids we are about to delete (FK integrity).
    _msgs_for_user = db.session.query(Message.id).filter(
        or_(Message.sender_id == user_id, Message.receiver_id == user_id)
    )
    ConversationReadState.query.filter(
        ConversationReadState.last_read_message_id.in_(_msgs_for_user)
    ).update({ConversationReadState.last_read_message_id: None}, synchronize_session=False)

    Message.query.filter(
        or_(Message.sender_id == user_id, Message.receiver_id == user_id)
    ).delete()

    # 3. Delete quiz results
    QuizResult.query.filter_by(user_id=user_id).delete()

    # 4. Delete user skips
    UserSkip.query.filter(
        (UserSkip.user_id == user_id) | (UserSkip.skipped_user_id == user_id)
    ).delete()

    # 5. Delete user blocks
    UserBlock.query.filter(
        (UserBlock.blocker_id == user_id) | (UserBlock.blocked_id == user_id)
    ).delete()

    # 6. Handle ReferredUsers relations
    if user.role == 'matchmaker':
        ReferredUsers.query.filter_by(matchmaker_id=user_id).delete()
    else:
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
            for i in range(1, 11):
                field_name = f'linked_dater_{i}_id'
                if getattr(ref_row, field_name) == user_id:
                    setattr(ref_row, field_name, None)

    # 7. Clear links pointing to this user
    linked_users = User.query.filter_by(linked_account_id=user_id).all()
    for linked_user in linked_users:
        linked_user.linked_account_id = None

    # 8. Clear referred_by links
    referred_users = User.query.filter_by(referred_by_id=user_id).all()
    for referred_user in referred_users:
        referred_user.referred_by_id = None

    # 9. Delete images + push tokens
    use_cloud_storage = current_app.config.get('USE_CLOUD_STORAGE', False)
    user_images = Image.query.filter_by(user_id=user_id).all()
    for image in user_images:
        if use_cloud_storage:
            storage_key = extract_key_from_url(image.image_url)
            if storage_key:
                delete_image_from_cloud(storage_key)
        else:
            try:
                file_path = os.path.join(current_app.root_path, image.image_url.lstrip('/'))
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                current_app.logger.error(f"Error deleting file from filesystem: {e}")

    Image.query.filter_by(user_id=user_id).delete()
    PushToken.query.filter_by(user_id=user_id).delete()


@profile_bp.route('/delete_account_by_role', methods=['DELETE'])
@token_required
def delete_account_by_role(current_user):
    """
    Delete either the dater or matchmaker account when both linked accounts exist.
    Keeps the other account active.
    """
    try:
        data = request.get_json() or {}
        target_role = data.get('role')

        if target_role not in ['user', 'matchmaker']:
            return jsonify({'error': "role must be 'user' or 'matchmaker'"}), 400

        if not current_user.linked_account_id:
            return jsonify({'error': 'No linked account found'}), 400

        linked_account = User.query.get(current_user.linked_account_id)
        if not linked_account:
            return jsonify({'error': 'Linked account not found'}), 404

        available_roles = {current_user.role, linked_account.role}
        if target_role not in available_roles:
            return jsonify({'error': f'No {target_role} account found to delete'}), 400

        if current_user.role == target_role:
            target_user = current_user
            remaining_user = linked_account
            deleting_current_account = True
        else:
            target_user = linked_account
            remaining_user = current_user
            deleting_current_account = False

        _delete_user_related_data(target_user)

        # Preserve the remaining account and fully unlink it.
        remaining_user.linked_account_id = None
        db.session.delete(target_user)
        db.session.commit()

        response = {
            'message': f"{'Dater' if target_role == 'user' else 'Matchmaker'} account deleted successfully",
            'user': remaining_user.to_dict(),
            'deleted_role': target_role,
        }

        if deleting_current_account:
            from flask_jwt_extended import create_access_token
            response['token'] = create_access_token(identity=str(remaining_user.id))
            response['switched'] = True
        else:
            response['switched'] = False

        return jsonify(response), 200

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

@profile_bp.route('/delete_account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    """
    Delete user account and all associated data (GDPR/CCPA Right to be Forgotten).
    If this user is linked to a second role (same email, dater + matchmaker), deletes both
    accounts and both sides' related data. No password required — JWT only.
    """
    try:
        linked_account = None
        if current_user.linked_account_id:
            linked_account = User.query.get(current_user.linked_account_id)

        # Clean dependencies for both users (order matters: each pass clears cross-links via
        # _delete_user_related_data step 7 before we remove the rows).
        _delete_user_related_data(current_user)
        if linked_account:
            _delete_user_related_data(linked_account)

        db.session.delete(current_user)
        if linked_account:
            db.session.delete(linked_account)
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
