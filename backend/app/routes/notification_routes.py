import os

from flask import Blueprint, jsonify, request
from app.models.userDB import User, PushToken
from app import db
from app.routes.shared import token_required
from app.services.notification_service import send_notification_to_user

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
    """Register push notification token for the current user (supports multiple devices).

    Uniqueness is (user_id, token): one row per token string. If the same token is posted
    again with a different platform, the row's platform is updated (e.g. client upgrade).
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        push_token = data.get('push_token')
        if not push_token:
            return jsonify({'error': 'push_token is required'}), 400

        platform = (data.get('platform') or 'expo').strip().lower()
        if platform not in ('expo', 'ios', 'android'):
            return jsonify({'error': 'platform must be expo, ios, or android'}), 400
        
        # Check if this token already exists for this user
        existing_token = PushToken.query.filter_by(
            user_id=current_user.id,
            token=push_token
        ).first()
        
        if existing_token:
            if (existing_token.platform or 'expo') != platform:
                existing_token.platform = platform
                db.session.commit()
            return jsonify({
                'message': 'Push token already registered',
                'push_token': push_token,
                'platform': existing_token.platform or 'expo',
            }), 200
        
        # Add new token for this user
        new_token = PushToken(user_id=current_user.id, token=push_token, platform=platform)
        db.session.add(new_token)
        db.session.commit()
        
        return jsonify({
            'message': 'Push token registered successfully',
            'push_token': push_token,
            'platform': platform,
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

def _test_push_endpoint_allowed():
    """Avoid open relay in production unless explicitly enabled."""
    if os.getenv("FLASK_ENV", "development") != "production":
        return True
    return os.getenv("ALLOW_TEST_PUSH", "").lower() in ("1", "true", "yes")


@notification_bp.route("/test_push", methods=["POST"])
@token_required
def test_push(current_user):
    """
    Send a test notification to the current user using the same pipeline as real pushes
    (Expo / APNs / FCM). Check server logs for per-token results.

    Disabled in production unless ALLOW_TEST_PUSH=true.
    Requires notifications_enabled and at least one registered token (or legacy push_token).
    """
    if not _test_push_endpoint_allowed():
        return jsonify({"error": "Not found"}), 404

    try:
        ok = send_notification_to_user(
            current_user.id,
            "Test notification",
            "If you see this, push delivery works.",
            {"type": "test"},
        )
        if not ok:
            user = User.query.get(current_user.id)
            reason = "send failed or no tokens"
            if user and not user.notifications_enabled:
                reason = "notifications_enabled is false"
            elif user:
                rows = PushToken.query.filter_by(user_id=user.id).count()
                if rows == 0 and not (user.push_token):
                    reason = "no push_tokens and no legacy users.push_token"
            return (
                jsonify(
                    {
                        "ok": False,
                        "message": reason,
                    }
                ),
                200,
            )

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Sent (check device and server logs for APNs/Expo errors)",
                }
            ),
            200,
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Unexpected server error", "details": str(e)}), 500


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
