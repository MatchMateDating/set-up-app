# app/services/notification_service.py
from exponent_server_sdk import (
    PushClient,
    PushMessage,
    PushServerError,
    DeviceNotRegisteredError,
    InvalidCredentialsError,
)
from app.models.userDB import User, PushToken
from app import db
from app.services.push_platforms import (
    InvalidPushToken,
    send_native_for_platform,
)
import logging

logger = logging.getLogger(__name__)

push_client = PushClient()


def _push_tokens_for_delivery(push_tokens):
    """
    Avoid duplicate alerts on one phone: dev clients may register both native (ios/android)
    and an Expo push token; APNs/FCM + Expo would each deliver the same message.
    If the user has any native token for a mobile OS, skip Expo rows for that send.
    """
    if not push_tokens:
        return push_tokens
    platforms = {(t.platform or "expo").lower() for t in push_tokens}
    if "ios" in platforms or "android" in platforms:
        return [t for t in push_tokens if (t.platform or "expo").lower() != "expo"]
    return list(push_tokens)


def _prune_push_token(token_obj):
    """Remove a dead push token row by id (avoids stale ORM instances and SAWarning on 0-row delete)."""
    try:
        tid = getattr(token_obj, "id", None)
        if tid is None:
            return
        n = PushToken.query.filter_by(id=tid).delete(synchronize_session="fetch")
        db.session.commit()
        if n:
            logger.info("Pruned push token id=%s", tid)
    except Exception as e:
        logger.error("Failed to prune push token id=%s: %s", getattr(token_obj, "id", None), e)
        db.session.rollback()


def _send_expo_push(token_str, title, body, data=None, token_obj=None, legacy_user=None):
    """
    Expo Push Service. token_obj / legacy_user used to prune invalid tokens.
    """
    if not token_str:
        return False
    data = data or {}
    try:
        message = PushMessage(
            to=token_str,
            title=title,
            body=body,
            data=data,
            sound="default",
        )
        response = push_client.publish(message)
        if response and hasattr(response, "status"):
            if response.status == "ok":
                return True
            logger.warning("Failed to send notification: %s", response)
            return False
        return True
    except DeviceNotRegisteredError:
        logger.warning("Device not registered: %s", token_str)
        if token_obj is not None:
            _prune_push_token(token_obj)
        elif legacy_user is not None:
            legacy_user.push_token = None
            db.session.commit()
        return False
    except InvalidCredentialsError:
        logger.error("Invalid credentials for push notifications")
        return False
    except PushServerError as e:
        logger.error("Push server error: %s", e)
        return False
    except Exception as e:
        logger.error("Error sending push notification: %s", e)
        return False


def send_push_to_token_row(token_obj, title, body, data=None):
    """Dispatch by PushToken.platform: expo (Expo relay) or ios / android (native)."""
    data = data or {}
    eff = (token_obj.platform or "expo").lower()
    if eff not in ("ios", "android", "expo"):
        eff = "expo"
    if eff == "expo":
        ok = _send_expo_push(
            token_obj.token, title, body, data, token_obj=token_obj, legacy_user=None
        )
        logger.info(
            "push token_id=%s platform=expo ok=%s",
            getattr(token_obj, "id", None),
            ok,
        )
        return ok
    try:
        ok = bool(
            send_native_for_platform(eff, token_obj.token, title, body, data)
        )
        logger.info(
            "push token_id=%s platform=%s ok=%s",
            getattr(token_obj, "id", None),
            eff,
            ok,
        )
        return ok
    except InvalidPushToken as e:
        logger.info(
            "push token_id=%s platform=%s invalid, pruning: %s",
            getattr(token_obj, "id", None),
            eff,
            e,
        )
        _prune_push_token(token_obj)
        return False


def send_push_notification(push_token, title, body, data=None, legacy_user=None):
    """
    Expo-only send for the legacy User.push_token column (no PushToken row).
    """
    return _send_expo_push(
        push_token, title, body, data, token_obj=None, legacy_user=legacy_user
    )


def send_notification_to_user(user_id, title, body, data=None):
    user = User.query.get(user_id)
    if not user:
        return False
    if not user.notifications_enabled:
        return False

    push_tokens = PushToken.query.filter_by(user_id=user_id).all()

    if not push_tokens:
        if user.push_token:
            return send_push_notification(
                user.push_token, title, body, data, legacy_user=user
            )
        return False

    push_tokens = _push_tokens_for_delivery(push_tokens)
    success_count = 0
    for token_obj in push_tokens:
        if send_push_to_token_row(token_obj, title, body, data):
            success_count += 1

    return success_count > 0


def send_message_notification(receiver_id, sender_id, match_id, message_text):
    receiver = User.query.get(receiver_id)
    sender = User.query.get(sender_id)

    if not receiver:
        logger.info(
            "message push skipped: receiver_id=%s not found", receiver_id
        )
        return False
    if not receiver.notifications_enabled:
        logger.info(
            "message push skipped: receiver_id=%s notifications_enabled=False",
            receiver_id,
        )
        return False
    if not sender:
        logger.info(
            "message push skipped: sender_id=%s not found", sender_id
        )
        return False

    sender_name = sender.first_name or "Someone"
    title = f"New message from {sender_name}"
    body = "You have a new message"
    data = {
        "type": "message",
        "matchId": str(match_id),
    }

    push_tokens = PushToken.query.filter_by(user_id=receiver_id).all()

    if not push_tokens:
        if receiver.push_token:
            ok = send_push_notification(
                receiver.push_token, title, body, data, legacy_user=receiver
            )
            logger.info(
                "message push receiver_id=%s match_id=%s legacy_user.push_token ok=%s",
                receiver_id,
                match_id,
                ok,
            )
            return ok
        logger.info(
            "message push skipped: receiver_id=%s has no push_tokens rows and no legacy push_token",
            receiver_id,
        )
        return False

    push_tokens = _push_tokens_for_delivery(push_tokens)
    logger.info(
        "message push start receiver_id=%s sender_id=%s match_id=%s token_rows=%s",
        receiver_id,
        sender_id,
        match_id,
        [(t.id, (t.platform or "expo")) for t in push_tokens],
    )

    success_count = 0
    for token_obj in push_tokens:
        if send_push_to_token_row(token_obj, title, body, data):
            success_count += 1

    ok = success_count > 0
    logger.info(
        "message push done receiver_id=%s match_id=%s ok=%s (%s/%s devices)",
        receiver_id,
        match_id,
        ok,
        success_count,
        len(push_tokens),
    )
    return ok


def send_match_notification(user_id, match_id, other_user_name):
    user = User.query.get(user_id)
    if not user:
        return False
    if not user.notifications_enabled:
        return False

    title = "New Match!"
    body = f"You have a new match with {other_user_name}"
    data = {
        "type": "match",
        "matchId": str(match_id),
    }

    push_tokens = PushToken.query.filter_by(user_id=user_id).all()

    if not push_tokens:
        if user.push_token:
            return send_push_notification(
                user.push_token, title, body, data, legacy_user=user
            )
        return False

    push_tokens = _push_tokens_for_delivery(push_tokens)
    success_count = 0
    for token_obj in push_tokens:
        if send_push_to_token_row(token_obj, title, body, data):
            success_count += 1

    return success_count > 0
