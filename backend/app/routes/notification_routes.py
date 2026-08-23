import os

from flask import Blueprint, jsonify, request
from datetime import datetime
import json

from app.models.userDB import User, PushToken
from app.models.matchDB import Match
from app import db
from app.routes.shared import token_required
from app.services.notification_service import send_notification_to_user
from app.services.push_platforms import apns_configured, vapid_configured


notification_bp = Blueprint('notification', __name__)

NOTIFICATION_PREFERENCE_FIELDS = (
    'new_match_notifications',
    'new_blind_match_notifications',
    'new_message_notifications',
    'approved_match_message_notifications',
    'new_match_approval_notifications',
)

ALLOWED_PUSH_PLATFORMS = ('expo', 'ios', 'android', 'web')


def _canonicalize_web_subscription(raw):
    """
    Normalize a PushSubscription (dict or JSON string) to a stable JSON string for storage.
    Returns None if invalid.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except (TypeError, ValueError):
            return None
    elif isinstance(raw, dict):
        data = raw
    else:
        return None

    endpoint = (data.get('endpoint') or '').strip()
    keys = data.get('keys') if isinstance(data.get('keys'), dict) else {}
    p256dh = (keys.get('p256dh') or '').strip()
    auth = (keys.get('auth') or '').strip()
    if not endpoint or not p256dh or not auth:
        return None

    canonical = {
        'endpoint': endpoint,
        'expirationTime': data.get('expirationTime'),
        'keys': {
            'auth': auth,
            'p256dh': p256dh,
        },
    }
    return json.dumps(canonical, separators=(',', ':'), sort_keys=True)


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
    vapid_ok = vapid_configured()
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
        elif "web" in plats and not vapid_ok:
            hint = "Web rows need VAPID env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT."
        elif "expo" in plats:
            hint = "Expo tokens use the Expo push API — check server Exponent SDK credentials and logs."
        else:
            hint = "Tokens exist but all sends failed — check Flask logs for FCM/APNs/Expo/Web Push errors; token may be stale."
    elif user and user.push_token:
        hint = "Using legacy users.push_token only — send failed; check Expo logs or migrate to push_tokens."
    out = {
        "push_tokens_count": len(rows),
        "platforms": platforms,
        "has_legacy_users_push_token": bool(user and user.push_token),
        "notifications_enabled": bool(user and user.notifications_enabled),
        "server_apns_configured": apns_ok,
        "server_fcm_credentials_present": fcm_ok,
        "server_vapid_configured": vapid_ok,
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
        
        # For linked dater+matchmaker accounts, keep notification settings in sync across both
        # so users receive pushes for either role regardless of which account is currently active.
        target_user_ids = [current_user.id]
        if getattr(current_user, "linked_account_id", None):
            target_user_ids.append(current_user.linked_account_id)

        enabled = bool(enabled)
        updated_ids = []

        for uid in target_user_ids:
            user = User.query.get(uid)
            if not user:
                continue

            was_enabled = bool(user.notifications_enabled)
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

            updated_ids.append(uid)

        db.session.commit()

        # Return the current user's updated view (what the app expects)
        refreshed = User.query.get(current_user.id)
        if not refreshed:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'message': 'Notification preferences updated successfully',
            'notifications_enabled': refreshed.notifications_enabled,
            'new_match_notifications': refreshed.notification_setting_enabled('new_match_notifications'),
            'new_blind_match_notifications': refreshed.notification_setting_enabled('new_blind_match_notifications'),
            'new_message_notifications': refreshed.notification_setting_enabled('new_message_notifications'),
            'approved_match_message_notifications': refreshed.notification_setting_enabled(
                'approved_match_message_notifications'
            ),
            'new_match_approval_notifications': refreshed.notification_setting_enabled(
                'new_match_approval_notifications'
            ),
            'user_id': refreshed.id,
            'linked_account_updated': len(updated_ids) > 1,
            'updated_user_ids': updated_ids,
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@notification_bp.route('/vapid_public_key', methods=['GET'])
def get_vapid_public_key():
    """Public VAPID key for Web Push subscribe (no auth required)."""
    from app.services.push_platforms import _push_config

    cfg = _push_config()
    public_key = (cfg.get('VAPID_PUBLIC_KEY') or '').strip()
    if not public_key:
        return jsonify({'error': 'Web Push is not configured on this server'}), 503
    return jsonify({'publicKey': public_key}), 200


@notification_bp.route('/register_token', methods=['POST'])
@token_required
def register_token(current_user):
    """Register push notification token for the current user (supports multiple devices).

    Token rows are stored per account (dater vs matchmaker). For users with a linked
    account, we also register the same device token on the linked account so that
    notifications for either role can be delivered even when the app is currently
    switched to the other role.

    To prevent cross-account leakage on shared test devices, if this token is found
    attached to *unrelated* user ids, we reassign those rows to the current user.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        push_token = data.get('push_token')
        if not push_token:
            return jsonify({'error': 'push_token is required'}), 400

        platform = (data.get('platform') or 'expo').strip().lower()
        if platform not in ALLOWED_PUSH_PLATFORMS:
            return jsonify({
                'error': 'platform must be expo, ios, android, or web'
            }), 400

        if platform == 'web':
            push_token = _canonicalize_web_subscription(push_token)
            if not push_token:
                return jsonify({
                    'error': 'web push_token must be a PushSubscription with endpoint and keys'
                }), 400
        elif not isinstance(push_token, str) or not push_token.strip():
            return jsonify({'error': 'push_token must be a non-empty string'}), 400
        else:
            push_token = push_token.strip()

        allowed_user_ids = {current_user.id}
        if getattr(current_user, "linked_account_id", None):
            allowed_user_ids.add(current_user.linked_account_id)

        # If this device token is attached to unrelated users, remove those rows instead of
        # reassigning them. Reassigning caused pushes for user B to land on a device logged
        # into user A (common when testing two email/account pairs on one phone).
        rows_other_users = PushToken.query.filter(
            PushToken.token == push_token,
            PushToken.user_id.notin_(list(allowed_user_ids)),
        ).all()
        if rows_other_users:
            for row in rows_other_users:
                db.session.delete(row)
            db.session.commit()

        # Register token for the current user, and also for their linked account (if any).
        user_ids_to_register = [current_user.id]
        if getattr(current_user, "linked_account_id", None):
            user_ids_to_register.append(current_user.linked_account_id)

        # Upsert for each target user id.
        any_created = False
        any_updated = False
        for uid in user_ids_to_register:
            existing_token = PushToken.query.filter_by(user_id=uid, token=push_token).first()
            if existing_token:
                if (existing_token.platform or 'expo') != platform:
                    existing_token.platform = platform
                    any_updated = True
                continue
            db.session.add(PushToken(user_id=uid, token=push_token, platform=platform))
            any_created = True

        db.session.commit()
        
        return jsonify({
            'message': 'Push token registered successfully' if any_created else 'Push token already registered',
            'push_token': push_token,
            'platform': platform,
            'linked_account_registered': bool(getattr(current_user, "linked_account_id", None)),
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


def _parse_match_id_list(raw_ids):
    """Normalize client match id strings to unique ints (invalid entries skipped)."""
    if not isinstance(raw_ids, list):
        return None, 'match_ids must be an array'
    seen = set()
    parsed = []
    for item in raw_ids:
        if item is None or item == '':
            continue
        try:
            mid = int(item)
        except (TypeError, ValueError):
            continue
        if mid in seen:
            continue
        seen.add(mid)
        parsed.append(mid)
    return parsed, None


@notification_bp.route('/match_mutes', methods=['GET'])
@token_required
def get_match_message_mutes(current_user):
    """Per-match message mute list for the current user (push suppression)."""
    try:
        match_ids = Match.muted_match_ids_for_user(current_user.id)
        return jsonify({'match_ids': match_ids}), 200
    except Exception as e:
        return jsonify({'error': 'Unexpected server error', 'details': str(e)}), 500


@notification_bp.route('/match_mutes', methods=['PUT'])
@token_required
def update_match_message_mutes(current_user):
    """Replace the current user's per-match message mute list."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400

        match_ids, err = _parse_match_id_list(data.get('match_ids'))
        if err:
            return jsonify({'error': err}), 400

        user_id = current_user.id
        Match.clear_mutes_for_user(user_id)
        muted_at = datetime.utcnow()
        for mid in match_ids:
            match = Match.query.get(mid)
            if match:
                match.set_muted_by(user_id, muted=True, at=muted_at)
        db.session.commit()

        return jsonify({'match_ids': [str(mid) for mid in match_ids]}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Unexpected server error', 'details': str(e)}), 500


@notification_bp.route('/unregister_token', methods=['POST'])
@token_required
def unregister_token(current_user):
    """Unregister a push notification token for the current user (and linked account)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        push_token = data.get('push_token')
        if not push_token:
            return jsonify({'error': 'push_token is required'}), 400

        # Accept web subscription objects the same way as register.
        if isinstance(push_token, dict) or (
            isinstance(push_token, str) and push_token.strip().startswith('{')
        ):
            canonical = _canonicalize_web_subscription(push_token)
            if canonical:
                push_token = canonical
        elif isinstance(push_token, str):
            push_token = push_token.strip()
        else:
            return jsonify({'error': 'push_token must be a string or subscription object'}), 400

        user_ids = [current_user.id]
        if getattr(current_user, 'linked_account_id', None):
            user_ids.append(current_user.linked_account_id)

        deleted = (
            PushToken.query.filter(
                PushToken.user_id.in_(user_ids),
                PushToken.token == push_token,
            ).delete(synchronize_session=False)
        )
        db.session.commit()

        if deleted:
            return jsonify({
                'message': 'Push token unregistered successfully'
            }), 200
        return jsonify({
            'message': 'Token not found for this user'
        }), 404
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500
