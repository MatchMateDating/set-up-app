# app/services/notification_service.py
from exponent_server_sdk import (
    PushClient,
    PushMessage,
    PushServerError,
    DeviceNotRegisteredError,
    InvalidCredentialsError,
)
from sqlalchemy import or_

from app.models.userDB import User, PushToken, ReferredUsers
from app.models.matchDB import Match
from app import db
from app.services.push_platforms import (
    InvalidPushToken,
    send_native_for_platform,
)
import logging

logger = logging.getLogger(__name__)

push_client = PushClient()


def _user_notification_allowed(user, preference_field=None):
    if not user or not user.notifications_enabled:
        return False
    if not preference_field:
        return True
    return user.notification_setting_enabled(preference_field)


def _should_skip_message_push_pending_dater_awaits_mm(match, receiver_id, receiver):
    """
    pending_approval: do not push messages to a dater whose matchmaker has not approved yet —
    they are not in the live Dater↔Dater conversation until that approval.
    """
    if not match or match.status != "pending_approval":
        return False
    if not receiver or getattr(receiver, "role", None) != "user":
        return False
    if receiver_id == match.user_id_1:
        has_mm = bool(match.matched_by_user_id_1_matcher)
        approved = bool(match.approved_by_matcher_1)
    elif receiver_id == match.user_id_2:
        has_mm = bool(match.matched_by_user_id_2_matcher)
        approved = bool(match.approved_by_matcher_2)
    else:
        return False
    if not has_mm:
        return False
    return not approved


def _notification_body_suffix(user):
    """Append account-type hint for users with both dater and matchmaker logins on one device."""
    if not user:
        return ""
    role = getattr(user, "role", None)
    if role == "matchmaker":
        return " (matchmaker)"
    if role == "user":
        return " (dater)"
    return ""


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
            logger.debug("Pruned push token id=%s", tid)
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
        logger.debug(
            "push token_id=%s platform=expo ok=%s",
            getattr(token_obj, "id", None),
            ok,
        )
        return ok
    try:
        ok = bool(
            send_native_for_platform(eff, token_obj.token, title, body, data)
        )
        logger.debug(
            "push token_id=%s platform=%s ok=%s",
            getattr(token_obj, "id", None),
            eff,
            ok,
        )
        return ok
    except InvalidPushToken as e:
        logger.warning(
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


def _dispatch_push_to_user(user, title, body, data=None):
    """Deliver a push to one user's devices. No preference checks; body should be final."""
    if not user:
        return False
    data = data or {}
    push_tokens = PushToken.query.filter_by(user_id=user.id).all()

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


def _matchmaker_ids_for_dater(dater_id, match=None):
    """
    Matchmakers who should receive mirrored notifications for this dater's activity:
    linked account, referred_by_id roster row, matchers on the match, and ReferredUsers slots.
    """
    ids = set()
    if not dater_id:
        return ids
    dater = User.query.get(dater_id)
    if not dater or getattr(dater, "role", None) != "user":
        return ids

    if dater.linked_account_id:
        u = User.query.get(dater.linked_account_id)
        if u and getattr(u, "role", None) == "matchmaker":
            ids.add(u.id)

    for mm in User.query.filter_by(referred_by_id=dater_id, role="matchmaker").all():
        ids.add(mm.id)

    if match:
        if match.user_id_1 == dater_id and match.matched_by_user_id_1_matcher:
            ids.add(match.matched_by_user_id_1_matcher)
        if match.user_id_2 == dater_id and match.matched_by_user_id_2_matcher:
            ids.add(match.matched_by_user_id_2_matcher)

    slot_filters = or_(
        *[
            getattr(ReferredUsers, f"linked_dater_{i}_id") == dater_id
            for i in range(1, 11)
        ]
    )
    for row in ReferredUsers.query.filter(slot_filters).all():
        ids.add(row.matchmaker_id)

    return ids


def _notify_matchmakers_for_message(
    receiver_id, sender_id, match_id, message_text, match, sender, receiver
):
    """Mirror message pushes to matchmakers tied to the receiving dater."""
    if not receiver or getattr(receiver, "role", None) != "user" or not sender:
        return False

    mm_ids = _matchmaker_ids_for_dater(receiver_id, match)
    if not mm_ids:
        return False

    sender_name = sender.first_name or "Someone"
    dater_label = receiver.first_name or "your dater"
    preview = (message_text or "").strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."
    title = f"New message for {dater_label}"
    body_base = preview if preview else "You have a new message"
    data = {
        "type": "message",
        "matchId": str(match_id) if match_id else "",
        "forDaterId": str(receiver_id),
    }

    any_ok = False
    for mm_id in mm_ids:
        mm = User.query.get(mm_id)
        if not mm or not _user_notification_allowed(mm, "new_message_notifications"):
            continue
        body = f"{body_base} · from {sender_name}{_notification_body_suffix(mm)}"
        if _dispatch_push_to_user(mm, title, body, data):
            any_ok = True
            logger.debug(
                "message push mirrored to matchmaker_id=%s for dater receiver_id=%s match_id=%s",
                mm_id,
                receiver_id,
                match_id,
            )
    return any_ok


def _notify_matchmakers_for_match(
    dater_id, match, match_id, other_user_name, is_blind_match, preference_field
):
    """Mirror new-match / blind-match pushes to that dater's matchmakers."""
    mm_ids = _matchmaker_ids_for_dater(dater_id, match)
    if not mm_ids:
        return False

    dater = User.query.get(dater_id)
    dater_label = (dater.first_name if dater else None) or "your dater"
    title = (
        f"New blind match for {dater_label}"
        if is_blind_match
        else f"New match for {dater_label}"
    )
    if is_blind_match:
        body_base = f"{dater_label} has a new blind match with {other_user_name}"
    else:
        body_base = f"{dater_label} has a new match with {other_user_name}"

    data = {
        "type": "blind_match" if is_blind_match else "match",
        "matchId": str(match_id) if match_id else "",
        "forDaterId": str(dater_id),
    }

    any_ok = False
    for mm_id in mm_ids:
        mm = User.query.get(mm_id)
        if not mm or not _user_notification_allowed(mm, preference_field):
            continue
        body = body_base + _notification_body_suffix(mm)
        if _dispatch_push_to_user(mm, title, body, data):
            any_ok = True
            logger.debug(
                "match push mirrored to matchmaker_id=%s for dater_id=%s match_id=%s",
                mm_id,
                dater_id,
                match_id,
            )
    return any_ok


def _notify_matchmakers_for_approval(dater_id, title, body, match_id, match):
    """Mirror match-approval pushes to that dater's matchmakers."""
    mm_ids = _matchmaker_ids_for_dater(dater_id, match)
    if not mm_ids:
        return False

    dater = User.query.get(dater_id)
    dater_label = (dater.first_name if dater else None) or "your dater"
    base_body = (body or "").strip()
    data = {
        "type": "match_approval",
        "matchId": str(match_id) if match_id else "",
        "forDaterId": str(dater_id),
    }

    any_ok = False
    for mm_id in mm_ids:
        mm = User.query.get(mm_id)
        if not mm or not _user_notification_allowed(mm, "new_match_approval_notifications"):
            continue
        mm_body = f"{base_body} ({dater_label}){_notification_body_suffix(mm)}"
        if _dispatch_push_to_user(mm, title, mm_body, data):
            any_ok = True
            logger.debug(
                "approval push mirrored to matchmaker_id=%s for dater_id=%s match_id=%s",
                mm_id,
                dater_id,
                match_id,
            )
    return any_ok


def send_notification_to_user(user_id, title, body, data=None):
    user = User.query.get(user_id)
    if not user:
        return False
    if not _user_notification_allowed(user):
        return False

    body = (body or "") + _notification_body_suffix(user)
    return _dispatch_push_to_user(user, title, body, data)


def send_message_notification(receiver_id, sender_id, match_id, message_text):
    receiver = User.query.get(receiver_id)
    sender = User.query.get(sender_id)

    if not receiver:
        logger.debug(
            "message push skipped: receiver_id=%s not found", receiver_id
        )
        return False
    if not sender:
        logger.debug(
            "message push skipped: sender_id=%s not found", sender_id
        )
        return False

    match = Match.query.get(match_id) if match_id else None

    dater_ok = False
    if _user_notification_allowed(receiver, "new_message_notifications"):
        if _should_skip_message_push_pending_dater_awaits_mm(
            match, receiver_id, receiver
        ):
            logger.debug(
                "message push skipped for dater: receiver_id=%s pending_approval, "
                "matchmaker not approved yet match_id=%s",
                receiver_id,
                match_id,
            )
        else:
            sender_name = sender.first_name or "Someone"
            title = f"New message from {sender_name}"
            preview = (message_text or "").strip()
            if len(preview) > 180:
                preview = preview[:177] + "..."
            body = preview if preview else "You have a new message"
            body = body + _notification_body_suffix(receiver)
            data = {
                "type": "message",
                "matchId": str(match_id) if match_id else "",
            }
            dater_ok = _dispatch_push_to_user(receiver, title, body, data)
            logger.info(
                "message push match_id=%s dater_ok=%s receiver_id=%s",
                match_id,
                dater_ok,
                receiver_id,
            )
    else:
        logger.debug(
            "message push skipped for dater: receiver_id=%s new_message_notifications disabled",
            receiver_id,
        )

    mm_ok = _notify_matchmakers_for_message(
        receiver_id, sender_id, match_id, message_text, match, sender, receiver
    )
    return dater_ok or mm_ok


def send_match_notification(user_id, match_id, other_user_name, is_blind_match=False):
    user = User.query.get(user_id)
    if not user:
        return False
    match = Match.query.get(match_id) if match_id else None
    preference_field = (
        "new_blind_match_notifications" if is_blind_match else "new_match_notifications"
    )

    ok = False
    if _user_notification_allowed(user, preference_field):
        title = "New Blind Match!" if is_blind_match else "New Match!"
        body = (
            f"You have a new blind match with {other_user_name}"
            if is_blind_match
            else f"You have a new match with {other_user_name}"
        )
        body = body + _notification_body_suffix(user)
        data = {
            "type": "blind_match" if is_blind_match else "match",
            "matchId": str(match_id) if match_id else "",
        }
        ok = _dispatch_push_to_user(user, title, body, data) or ok

    if getattr(user, "role", None) == "user":
        mm_ok = _notify_matchmakers_for_match(
            user.id, match, match_id, other_user_name, is_blind_match, preference_field
        )
        ok = mm_ok or ok

    return ok


def send_approved_match_notification(user_id, title, body, match_id):
    """Push when a pending match is approved (matchmakers or daters)."""
    user = User.query.get(user_id)
    if not user:
        return False
    match = Match.query.get(match_id) if match_id else None

    ok = False
    if _user_notification_allowed(user, "new_match_approval_notifications"):
        bod = (body or "") + _notification_body_suffix(user)
        data = {
            "type": "match_approval",
            "matchId": str(match_id) if match_id else "",
        }
        ok = _dispatch_push_to_user(user, title, bod, data)

    if getattr(user, "role", None) == "user":
        ok = _notify_matchmakers_for_approval(user.id, title, body, match_id, match) or ok

    return ok
