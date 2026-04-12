import os

from flask import Blueprint, jsonify, request
from app.models.userDB import User, PushToken
from app import db
from app.routes.shared import token_required
from app.services.notification_service import send_notification_to_user
from app.services.push_platforms import apns_configured

notification_bp = Blueprint('notification', __name__)

NOTIFICATION_PREFERENCE_FIELDS = (
    'new_match_notifications',
    'new_blind_match_notifications',
    'new_message_notifications',
    'new_match_approval_notifications',
)


def _firebase_credentials_present():
    """True if FCM service account path or JSON is set (server-side send)."""
    from app.services.push_platforms import _push_config

    cfg = _push_config()
    path = cfg.get("FIREBASE_CREDENTIALS_PATH")
    if path and os.path.isfile(path):
        return True
    raw = cfg.get("FIREBASE_CREDENTIALS_JSON")
    return bool(raw and str(raw).strip())


def _firebase_env_diagnostics():
    """Safe booleans: path set in Flask config vs file on disk (no path strings)."""
    from app.services.push_platforms import _push_config

    cfg = _push_config()
    path = (cfg.get("FIREBASE_CREDENTIALS_PATH") or "").strip()
    raw = (cfg.get("FIREBASE_CREDENTIALS_JSON") or "").strip()
    return {
        "firebase_path_set_in_config": bool(path),
        "firebase_path_file_exists": bool(path and os.path.isfile(path)),
        "firebase_json_set_in_config": bool(raw),
    }


def _test_push_failure_extras(user):
    """Safe fields for debugging test_push without exposing tokens."""
    rows = PushToken.query.filter_by(user_id=user.id).all() if user else []
    platforms = [((r.platform or "expo").lower()) for r in rows]
    apns_ok = apns_configured()
    fcm_ok = _firebase_credentials_present()
    fb_diag = _firebase_env_diagnostics()
    hint = None
    if not rows and not (user and user.push_token):
        hint = "No device tokens in push_tokens and no legacy users.push_token — open the app and register (enable notifications)."
    elif rows:
        plats = set(platforms)
        if "android" in plats and not fcm_ok:
            if fb_diag.get("firebase_path_set_in_config") and not fb_diag.get(
                "firebase_path_file_exists"
            ):
                hint = (
                    "FIREBASE_CREDENTIALS_PATH is set in Flask config but the file was not found on disk — "
                    "fix the path or move the JSON; set it in backend/.env and restart."
                )
            elif not fb_diag.get("firebase_path_set_in_config") and not fb_diag.get(
                "firebase_json_set_in_config"
            ):
                hint = (
                    "No Firebase Admin credentials in Flask config — set FIREBASE_CREDENTIALS_PATH or "
                    "FIREBASE_CREDENTIALS_JSON in backend/.env (recommended) or system env, then restart the server."
                )
            else:
                hint = "Android rows need Firebase Admin credentials: FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON on this server."
        elif "ios" in plats and not apns_ok:
            hint = "iOS rows need APNs env: APNS_KEY_*, APNS_TOPIC, etc."
        elif "expo" in plats:
            hint = "Expo tokens use the Expo push API — check server Exponent SDK credentials and logs."
        else:
            hint = "Tokens exist but all sends failed — check Flask logs for FCM/APNs/Expo errors; token may be stale."
    elif user and user.push_token:
        hint = "Using legacy users.push_token only — send failed; check Expo logs or migrate to push_tokens."
    out = {
        "push_tokens_count": len(rows),
        "platforms": platforms,
        "has_legacy_users_push_token": bool(user and user.push_token),
        "notifications_enabled": bool(user and user.notifications_enabled),
        "server_apns_configured": apns_ok,
        "server_fcm_credentials_present": fcm_ok,
        "hint": hint,
    }
    out.update(fb_diag)
    return out

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
        
        was_enabled = bool(user.notifications_enabled)
        enabled = bool(enabled)

        # Update only this specific user's notification preference
        user.notifications_enabled = enabled
        if not enabled:
            for field in NOTIFICATION_PREFERENCE_FIELDS:
                setattr(user, field, False)
        else:
            for field in NOTIFICATION_PREFERENCE_FIELDS:
                if field in data:
                    value = bool(data.get(field))
                elif not was_enabled:
                    value = True
                else:
                    existing_value = getattr(user, field, None)
                    value = True if existing_value is None else bool(existing_value)
                setattr(user, field, value)
        db.session.commit()
        
        # Refresh to ensure we return the updated value
        db.session.refresh(user)
        
        return jsonify({
            'message': 'Notification preferences updated successfully',
            'notifications_enabled': user.notifications_enabled,
            'new_match_notifications': user.notification_setting_enabled('new_match_notifications'),
            'new_blind_match_notifications': user.notification_setting_enabled('new_blind_match_notifications'),
            'new_message_notifications': user.notification_setting_enabled('new_message_notifications'),
            'new_match_approval_notifications': user.notification_setting_enabled(
                'new_match_approval_notifications'
            ),
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
            extras = _test_push_failure_extras(user) if user else {}
            return (
                jsonify(
                    {
                        "ok": False,
                        "message": reason,
                        **extras,
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
