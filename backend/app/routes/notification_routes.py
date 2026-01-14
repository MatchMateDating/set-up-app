from flask import Blueprint, jsonify, request
from app.models.userDB import User, PushToken
from app import db
from app.routes.shared import token_required

notification_bp = Blueprint('notification', __name__)

@notification_bp.route('/preferences', methods=['PUT'])
@token_required
def update_notification_preferences(current_user):
    """Update notification preferences for the current user (user-scoped)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        enabled = data.get('enabled')
        if enabled is None:
            return jsonify({'error': 'enabled field is required'}), 400
        
        # Explicitly update only the current authenticated user's preference
        # This ensures we never accidentally update another user's settings
        user_id = current_user.id
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify this is the same user (extra safety check)
        if user.id != current_user.id:
            return jsonify({'error': 'User mismatch detected'}), 403
        
        # Update only this specific user's notification preference
        user.notifications_enabled = bool(enabled)
        db.session.commit()
        
        # Refresh to ensure we return the updated value
        db.session.refresh(user)
        
        return jsonify({
            'message': 'Notification preferences updated successfully',
            'notifications_enabled': user.notifications_enabled,
            'user_id': user.id  # Include user_id in response for verification
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@notification_bp.route('/register_token', methods=['POST'])
@token_required
def register_token(current_user):
    """Register push notification token for the current user (supports multiple devices)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        push_token = data.get('push_token')
        if not push_token:
            return jsonify({'error': 'push_token is required'}), 400
        
        # Check if this token already exists for this user
        existing_token = PushToken.query.filter_by(
            user_id=current_user.id,
            token=push_token
        ).first()
        
        if existing_token:
            # Token already registered for this user
            return jsonify({
                'message': 'Push token already registered',
                'push_token': push_token
            }), 200
        
        # Add new token for this user
        new_token = PushToken(user_id=current_user.id, token=push_token)
        db.session.add(new_token)
        db.session.commit()
        
        return jsonify({
            'message': 'Push token registered successfully',
            'push_token': push_token
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@notification_bp.route('/unregister_token', methods=['POST'])
@token_required
def unregister_token(current_user):
    """Unregister a push notification token for the current user"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        push_token = data.get('push_token')
        if not push_token:
            return jsonify({'error': 'push_token is required'}), 400
        
        # Find and delete the token
        token_obj = PushToken.query.filter_by(
            user_id=current_user.id,
            token=push_token
        ).first()
        
        if token_obj:
            db.session.delete(token_obj)
            db.session.commit()
            return jsonify({
                'message': 'Push token unregistered successfully'
            }), 200
        else:
            return jsonify({
                'message': 'Token not found for this user'
            }), 404
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500
