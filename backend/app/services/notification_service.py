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


def _matchmaker_ids_linked_to_dater(dater_id):
    """Matchmaker user ids for this dater: ReferredUsers roster + MM accounts with referred_by_id = dater."""
    if not dater_id:
        return []
    conds = [
        getattr(ReferredUsers, f"linked_dater_{i}_id") == dater_id for i in range(1, 11)
    ]
    rows = ReferredUsers.query.filter(or_(*conds)).all()
    ids = [r.matchmaker_id for r in rows]
    seen = set(ids)
    # Fallback: active linked dater on matchmaker profile (some rows only set this)
    for mm in User.query.filter_by(referred_by_id=dater_id, role="matchmaker").all():
        if mm.id not in seen:
            seen.add(mm.id)
            ids.append(mm.id)
    return ids


def _deliver_message_push_tokens(target_user, title, body_with_suffix, data, match_id, log_receiver_id):
    """Send message push to one user's registered devices."""
    push_tokens = PushToken.query.filter_by(user_id=target_user.id).all()

    if not push_tokens:
        if target_user.push_token:
            ok = send_push_notification(
                target_user.push_token,
                title,
                body_with_suffix,
                data,
                legacy_user=target_user,
            )
            logger.debug(
                "message push receiver_id=%s match_id=%s legacy_user.push_token ok=%s",
                log_receiver_id,
                match_id,
                ok,
            )
            return ok
        logger.debug(
            "message push skipped: receiver_id=%s has no push_tokens rows and no legacy push_token",
            log_receiver_id,
        )
        return False

    push_tokens = _push_tokens_for_delivery(push_tokens)
    logger.debug(
        "message push start receiver_id=%s match_id=%s token_rows=%s",
        log_receiver_id,
        match_id,
        [(t.id, (t.platform or "expo")) for t in push_tokens],
    )

    success_count = 0
    for token_obj in push_tokens:
        if send_push_to_token_row(token_obj, title, body_with_suffix, data):
            success_count += 1

    ok = success_count > 0
    logger.info(
        "message push match_id=%s ok=%s devices=%s/%s",
        match_id,
        ok,
        success_count,
        len(push_tokens),
    )
    return ok


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


def send_notification_to_user(user_id, title, body, data=None):
    user = User.query.get(user_id)
    if not user:
        return False
    if not _user_notification_allowed(user):
        return False

    body = (body or "") + _notification_body_suffix(user)

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


def send_message_notification(receiver_id, sender_id, match_id, message_text, auth_sender_id=None):
    """
    Notify the receiving dater and any matchmakers linked to that dater (tokens are on MM accounts).
    auth_sender_id: authenticated User.id of the sender; skips notifying that matchmaker when they sent.
    """
    dater_receiver = User.query.get(receiver_id)
    sender = User.query.get(sender_id)

    if not dater_receiver:
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
    skip_dater_push = _should_skip_message_push_pending_dater_awaits_mm(
        match, receiver_id, dater_receiver
    )
    if skip_dater_push:
        logger.debug(
            "message push to dater skipped: receiver_id=%s pending_approval, matchmaker not approved yet match_id=%s",
            receiver_id,
            match_id,
        )

    sender_name = sender.first_name or "Someone"
    title = f"New message from {sender_name}"
    preview = (message_text or "").strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."
    base_body = preview if preview else "You have a new message"
    data = {
        "type": "message",
        "matchId": str(match_id),
    }

    any_ok = False

    if not skip_dater_push and _user_notification_allowed(
        dater_receiver, "new_message_notifications"
    ):
        body = base_body + _notification_body_suffix(dater_receiver)
        any_ok = (
            _deliver_message_push_tokens(
                dater_receiver, title, body, data, match_id, receiver_id
            )
            or any_ok
        )

    for mm_id in _matchmaker_ids_linked_to_dater(receiver_id):
        if auth_sender_id is not None and mm_id == auth_sender_id:
            continue
        mm = User.query.get(mm_id)
        if not mm or not _user_notification_allowed(mm, "new_message_notifications"):
            continue
        body_mm = base_body + _notification_body_suffix(mm)
        any_ok = (
            _deliver_message_push_tokens(mm, title, body_mm, data, match_id, mm_id)
            or any_ok
        )

    return any_ok


def _deliver_new_match_push(user_id, user, title, body, data):
    """Deliver one new-match notification to all tokens for user_id."""
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


def send_new_match_push_to_dater(
    user_id,
    match_id,
    counterparty_first_name,
    *,
    is_blind_match,
    is_matchmaker_mediated,
):
    """
    Push to a dater user row only. Copy always ends with (dater), never (matchmaker).
    Does not use User.role — same person may have role matchmaker on another row.
    """
    user = User.query.get(user_id)
    if not user:
        return False
    preference_field = (
        "new_blind_match_notifications" if is_blind_match else "new_match_notifications"
    )
    if not _user_notification_allowed(user, preference_field):
        return False

    title = "New Blind Match!" if is_blind_match else "New Match!"
    cp = (counterparty_first_name or "Someone").strip() or "Someone"
    if is_matchmaker_mediated:
        if is_blind_match:
            body = f"you have a new blind matchmaker match with {cp}(dater)"
        else:
            body = f"you have a new matchmaker match with {cp}(dater)"
    else:
        if is_blind_match:
            body = f"you have a new blind match with {cp}(dater)"
        else:
            body = f"you have a new match with {cp}(dater)"

    data = {
        "type": "blind_match" if is_blind_match else "match",
        "matchId": str(match_id),
        "recipientRole": "dater",
    }
    return _deliver_new_match_push(user_id, user, title, body, data)


def send_new_match_push_to_matchmaker(mm_user_id, match_id, managed_dater_first_name, *, is_blind_match):
    """
    Push to a matchmaker user row only. Copy references the managed dater, ends with (matchmaker).
    """
    user = User.query.get(mm_user_id)
    if not user:
        return False
    if not _user_notification_allowed(user, "new_match_notifications"):
        return False

    title = "New Blind Match!" if is_blind_match else "New Match!"
    display = (managed_dater_first_name or "Someone").strip() or "Someone"
    if is_blind_match:
        body = f"you have a new blind match with {display}(matchmaker)"
    else:
        body = f"you have a new match with {display}(matchmaker)"

    data = {
        "type": "blind_match" if is_blind_match else "match",
        "matchId": str(match_id),
        "recipientRole": "matchmaker",
    }
    return _deliver_new_match_push(mm_user_id, user, title, body, data)


def send_match_notification_to_linked_matchmakers(
    dater_id,
    match_id,
    counterparty_first_name,
    is_blind_match=False,
    skip_matchmaker_ids=None,
):
    """Fan-out new-match push to matchmakers who manage this dater (devices register under MM user ids)."""
    managed = User.query.get(dater_id)
    managed_name = (managed.first_name if managed else None) or "Someone"
    skip = set(skip_matchmaker_ids or [])
    any_ok = False
    for mm_id in _matchmaker_ids_linked_to_dater(dater_id):
        if mm_id in skip:
            continue
        mm_user = User.query.get(mm_id)
        if not mm_user or getattr(mm_user, "role", None) != "matchmaker":
            continue
        if send_new_match_push_to_matchmaker(
            mm_id,
            match_id,
            managed_name,
            is_blind_match=is_blind_match,
        ):
            any_ok = True
    return any_ok


def send_approved_match_notification(user_id, title, body, match_id):
    """Push when a pending match is approved (matchmakers or daters)."""
    user = User.query.get(user_id)
    if not user:
        return False
    if not _user_notification_allowed(user, "new_match_approval_notifications"):
        return False

    body = (body or "") + _notification_body_suffix(user)

    data = {
        "type": "match_approval",
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
