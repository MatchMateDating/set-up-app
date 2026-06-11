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
    send_native_data_sync,
    send_native_for_platform,
)
import logging

logger = logging.getLogger(__name__)

push_client = PushClient()

def _recipient_role_value(user):
    """Notification routing hint for the mobile client: 'dater' vs 'matchmaker'."""
    role = getattr(user, "role", None)
    if role == "matchmaker":
        return "matchmaker"
    if role == "user":
        return "dater"
    return None


def _user_notification_allowed(user, preference_field=None):
    if not user or not user.notifications_enabled:
        return False
    if not preference_field:
        return True
    return user.notification_setting_enabled(preference_field)


def _pending_mm_removed_from_thread(match, mm_user_id):
    """True if this matchmaker was removed from the pending-approval thread by their dater."""
    if not match or match.status != "pending_approval" or not mm_user_id:
        return False
    if match.matched_by_user_id_1_matcher == mm_user_id and bool(
        getattr(match, "dater_removed_matcher_1", False)
    ):
        return True
    if match.matched_by_user_id_2_matcher == mm_user_id and bool(
        getattr(match, "dater_removed_matcher_2", False)
    ):
        return True
    return False


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


def _msg_display_first_name(user):
    if not user:
        return "Someone"
    return (getattr(user, "first_name", None) or "Someone").strip() or "Someone"


def _counterparty_dater_id(match, dater_id):
    if not match or not dater_id:
        return None
    if match.user_id_1 == dater_id:
        return match.user_id_2
    if match.user_id_2 == dater_id:
        return match.user_id_1
    return None


def _match_has_dedicated_matchmaker(match):
    return bool(
        match
        and (
            match.matched_by_user_id_1_matcher
            or match.matched_by_user_id_2_matcher
        )
    )


def _match_two_matchmakers(match):
    return bool(
        match
        and match.matched_by_user_id_1_matcher
        and match.matched_by_user_id_2_matcher
    )


def _matchmaker_approved_match_message_pushes_enabled(mm_user):
    """Matchmaker-only: off = no push for new messages in fully approved (matched) chats; pending approval unchanged."""
    if not mm_user:
        return False
    return mm_user.notification_setting_enabled("approved_match_message_notifications")


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


def _user_muted_match_message(user_id, match_id):
    """True if this user muted push alerts for new messages in this match."""
    if not user_id or match_id is None:
        return False
    try:
        mid = int(match_id)
    except (TypeError, ValueError):
        return False
    match = Match.query.get(mid)
    if not match:
        return False
    return match.is_muted_by(user_id)


def _deliver_message_push_tokens(
    target_user,
    title,
    body_with_suffix,
    data,
    match_id,
    log_receiver_id,
    *,
    skip_if_muted=True,
):
    """Send message push to one user's registered devices."""
    if skip_if_muted and _user_muted_match_message(
        getattr(target_user, "id", None), match_id
    ):
        logger.debug(
            "message push skipped: receiver_id=%s muted match_id=%s",
            log_receiver_id,
            match_id,
        )
        return False

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
    # Normalize and de-dupe: tokens can accumulate over time (reinstalls, dev builds, etc).
    # We prefer the most recent token per platform to prevent a single device receiving
    # multiple notifications due to stale-but-still-valid token rows.
    normalized = []
    for t in push_tokens:
        eff = (t.platform or "expo").lower()
        if eff not in ("ios", "android", "expo"):
            eff = "expo"
        normalized.append((eff, t))

    platforms = {eff for eff, _ in normalized}
    if "ios" in platforms or "android" in platforms:
        normalized = [(eff, t) for eff, t in normalized if eff != "expo"]

    # Keep the newest row per (platform, token_string). Then, if multiple distinct tokens
    # exist for the same platform, keep only the newest one to avoid duplicate delivery
    # to a single phone with rotated tokens.
    by_platform = {}
    for eff, t in normalized:
        by_platform.setdefault(eff, [])
        by_platform[eff].append(t)

    selected = []
    for eff, rows in by_platform.items():
        # unique by token string first
        seen = {}
        for r in rows:
            key = (r.token or "").strip()
            if not key:
                continue
            prev = seen.get(key)
            if prev is None or (getattr(r, "created_at", None) and getattr(prev, "created_at", None) and r.created_at > prev.created_at):
                seen[key] = r
            elif prev is None:
                seen[key] = r

        uniq = list(seen.values())
        uniq.sort(key=lambda x: getattr(x, "created_at", None) or 0, reverse=True)
        if uniq:
            # keep newest token for this platform
            selected.append(uniq[0])

    return selected


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


def _send_expo_push_data_sync(
    token_str, data, token_obj=None, legacy_user=None
):
    """
    Data + priority only (no title/body/sound) for client-side state updates.
    """
    if not token_str:
        return False
    data = data or {}
    try:
        message = PushMessage(
            to=token_str,
            data=data,
            priority="high",
        )
        response = push_client.publish(message)
        if response and hasattr(response, "status"):
            if response.status == "ok":
                return True
            logger.warning("Failed to send data sync push: %s", response)
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
        logger.error("Error sending data sync push: %s", e)
        return False


def send_unmatch_sync_push_to_token_row(token_obj, data):
    eff = (token_obj.platform or "expo").lower()
    if eff not in ("ios", "android", "expo"):
        eff = "expo"
    if eff == "expo":
        return _send_expo_push_data_sync(
            token_obj.token, data, token_obj=token_obj, legacy_user=None
        )
    try:
        return bool(
            send_native_data_sync(eff, token_obj.token, data)
        )
    except InvalidPushToken as e:
        logger.warning("unmatch sync token invalid, pruning: %s", e)
        _prune_push_token(token_obj)
        return False
    except Exception as e:
        logger.warning("unmatch sync native send failed: %s", e)
        return False


def _deliver_unmatch_sync_to_user(target_user, data, match_id, log_receiver_id):
    """Ignore notifications_enabled; requires at least one device token."""
    push_tokens = PushToken.query.filter_by(user_id=target_user.id).all()
    if not push_tokens:
        if target_user.push_token:
            ok = _send_expo_push_data_sync(
                target_user.push_token, data, token_obj=None, legacy_user=target_user
            )
            logger.debug(
                "unmatch sync (legacy) receiver_id=%s match_id=%s ok=%s",
                log_receiver_id,
                match_id,
                ok,
            )
            return ok
        logger.debug(
            "unmatch sync skipped: receiver_id=%s has no device tokens", log_receiver_id
        )
        return False

    push_tokens = _push_tokens_for_delivery(push_tokens)
    success_count = 0
    for token_obj in push_tokens:
        if send_unmatch_sync_push_to_token_row(token_obj, data):
            success_count += 1
    return success_count > 0


def send_unmatch_sync_for_match(match):
    """
    Data-only push so clients remove the match from UI and close the chat, without
    a user-visible alert. Does not honor user notification toggles.
    """
    if not match:
        return False
    mid = match.id
    ids = set()
    for attr in ("user_id_1", "user_id_2"):
        uid = getattr(match, attr, None)
        if uid:
            ids.add(uid)
    for attr in (
        "matched_by_user_id_1_matcher",
        "matched_by_user_id_2_matcher",
    ):
        mm = getattr(match, attr, None)
        if mm:
            ids.add(mm)
    for dater_id in (getattr(match, "user_id_1", None), getattr(match, "user_id_2", None)):
        if not dater_id:
            continue
        for mm_id in _matchmaker_ids_linked_to_dater(dater_id):
            ids.add(mm_id)

    any_ok = False
    for user_id in ids:
        user = User.query.get(user_id)
        if not user:
            continue
        data = {
            "type": "unmatch",
            "matchId": str(mid),
        }
        role = _recipient_role_value(user)
        if role:
            data["recipientRole"] = role
        if _deliver_unmatch_sync_to_user(user, data, mid, user_id):
            any_ok = True
    return any_ok


def send_dater_removed_matchmaker_sync(match_id, matchmaker_user_id):
    """
    Data-only push to the matchmaker who was removed from a thread so clients
    close the open chat immediately (same delivery path as unmatch sync).
    """
    if not match_id or not matchmaker_user_id:
        return False
    user = User.query.get(matchmaker_user_id)
    if not user:
        return False
    data = {
        "type": "dater_removed_matchmaker",
        "matchId": str(match_id),
    }
    role = _recipient_role_value(user)
    if role:
        data["recipientRole"] = role
    return bool(_deliver_unmatch_sync_to_user(user, data, match_id, matchmaker_user_id))


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


def send_message_notification(
    receiver_id,
    sender_id,
    match_id,
    message_text,
    auth_sender_id=None,
    *,
    puzzle_type=None,
):
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

    auth_sender = User.query.get(auth_sender_id) if auth_sender_id else None
    auth_sender_role = getattr(auth_sender, "role", None) if auth_sender else None

    is_puzzle = bool(puzzle_type)

    preview = (message_text or "").strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."
    preview_body = preview if preview else "You have a new message"
    if is_puzzle:
        preview_body = f"Sent {puzzle_type}"

    cp_id = _counterparty_dater_id(match, receiver_id) if match else None
    cp_user = User.query.get(cp_id) if cp_id else None
    cp_name = _msg_display_first_name(cp_user)

    # Dater titles:
    # - approved chat: other dater's first name
    # - approved chat + matchmaker sent puzzle: "{other dater}'s matchmaker"
    # - pending_approval + matchmaker sent: "{other dater}'s matchmaker"
    # - otherwise: sender first name (legacy behavior)
    if match and match.status == "matched" and auth_sender_role == "matchmaker" and is_puzzle:
        dater_title = f"{cp_name}'s matchmaker"
    elif match and match.status == "matched":
        dater_title = cp_name
    elif match and match.status == "pending_approval" and auth_sender_role == "matchmaker":
        dater_title = f"{cp_name}'s matchmaker"
    else:
        dater_title = _msg_display_first_name(sender)

    base_data = {
        "type": "message",
        "matchId": str(match_id),
    }
    if match:
        base_data["matchStatus"] = match.status

    any_ok = False
    notified_mm_ids = set()

    # Deliver message pushes even if the user disabled "new_message_notifications" preference,
    # so the client can keep unread counts in sync; the client can suppress UI display.
    if not skip_dater_push and _user_notification_allowed(dater_receiver):
        data = dict(base_data)
        data["recipientRole"] = "dater"
        any_ok = (
            _deliver_message_push_tokens(
                dater_receiver, dater_title, preview_body, data, match_id, receiver_id
            )
            or any_ok
        )

    # Approved + matchmaker sent puzzle: also notify the matchmaker's linked dater.
    if match and match.status == "matched" and auth_sender_role == "matchmaker" and is_puzzle:
        linked_dater = User.query.get(sender_id)
        if linked_dater and _user_notification_allowed(linked_dater):
            data_ld = dict(base_data)
            data_ld["recipientRole"] = "dater"
            any_ok = (
                _deliver_message_push_tokens(
                    linked_dater,
                    "Your Matchmaker",
                    f"Sent {puzzle_type}",
                    data_ld,
                    match_id,
                    sender_id,
                )
                or any_ok
            )

    linked_name = _msg_display_first_name(dater_receiver)
    for mm_id in _matchmaker_ids_linked_to_dater(receiver_id):
        if _pending_mm_removed_from_thread(match, mm_id):
            continue
        if auth_sender_id is not None and mm_id == auth_sender_id:
            continue
        mm = User.query.get(mm_id)
        if not mm or not _user_notification_allowed(mm):
            continue
        if match and match.status == "matched" and not _matchmaker_approved_match_message_pushes_enabled(
            mm
        ):
            continue

        if match and match.status == "pending_approval":
            if _match_two_matchmakers(match):
                mm_title = f"{cp_name}'s matchmaker"
            else:
                mm_title = cp_name
            # Pending approval + dater sent: show pending state in MM title.
            if auth_sender_role == "user":
                mm_title = f"{_msg_display_first_name(sender)} - pending approval"
            mm_body_text = preview_body
        elif match and match.status == "matched" and _match_has_dedicated_matchmaker(
            match
        ):
            mm_title = _msg_display_first_name(sender)
            mm_body_text = f"{linked_name} has a new message"
        else:
            mm_title = _msg_display_first_name(sender)
            mm_body_text = preview_body

        data_mm = dict(base_data)
        data_mm["recipientRole"] = "matchmaker"
        any_ok = (
            _deliver_message_push_tokens(mm, mm_title, mm_body_text, data_mm, match_id, mm_id)
            or any_ok
        )
        notified_mm_ids.add(mm_id)

    # Pending approval: when a dater sends (especially after their MM approved),
    # also notify the sender's matchmaker(s) so they see activity on their side.
    if match and match.status == "pending_approval" and auth_sender_role == "user":
        sender_name = _msg_display_first_name(sender)
        for mm_id in _matchmaker_ids_linked_to_dater(sender_id):
            if _pending_mm_removed_from_thread(match, mm_id):
                continue
            if mm_id in notified_mm_ids:
                continue
            mm = User.query.get(mm_id)
            if not mm or not _user_notification_allowed(mm):
                continue
            data_mm = dict(base_data)
            data_mm["recipientRole"] = "matchmaker"
            any_ok = (
                _deliver_message_push_tokens(
                    mm,
                    f"{sender_name} - pending approval",
                    preview_body,
                    data_mm,
                    match_id,
                    mm_id,
                )
                or any_ok
            )
            notified_mm_ids.add(mm_id)

    # Approved + matchmaker-involved: also notify the sender's matchmaker(s) when the linked
    # dater sends a message (so the MM sees activity even though they aren't receiver-side).
    if match and match.status == "matched" and _match_has_dedicated_matchmaker(match) and auth_sender_role == "user":
        sender_name = _msg_display_first_name(sender)
        for mm_id in _matchmaker_ids_linked_to_dater(sender_id):
            if mm_id in notified_mm_ids:
                continue
            mm = User.query.get(mm_id)
            if not mm or not _user_notification_allowed(mm):
                continue
            if not _matchmaker_approved_match_message_pushes_enabled(mm):
                continue
            data_mm = dict(base_data)
            data_mm["recipientRole"] = "matchmaker"
            any_ok = (
                _deliver_message_push_tokens(
                    mm,
                    sender_name,
                    f"{sender_name} sent a new message",
                    data_mm,
                    match_id,
                    mm_id,
                )
                or any_ok
            )
            notified_mm_ids.add(mm_id)

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
            body = f"You have a new blind matchmaker match with {cp}"
        else:
            body = f"You have a new matchmaker match with {cp}"
    else:
        if is_blind_match:
            body = f"You have a new blind match with {cp}"
        else:
            body = f"You have a new match with {cp}"

    data = {
        "type": "blind_match" if is_blind_match else "match",
        "matchId": str(match_id),
        "recipientRole": "dater",
    }
    return _deliver_new_match_push(user_id, user, title, body, data)


def send_new_match_push_to_matchmaker(
    mm_user_id,
    match_id,
    linked_dater_first_name,
    matched_dater_first_name,
    *,
    is_blind_match,
    linked_dater_id=None,
):
    """
    Push to a matchmaker user row only. Names the roster dater and their match, ends with (matchmaker).
    """
    user = User.query.get(mm_user_id)
    if not user:
        return False
    if not _user_notification_allowed(user, "new_match_notifications"):
        return False

    title = "New Blind Match!" if is_blind_match else "New Match!"
    linked = (linked_dater_first_name or "Someone").strip() or "Someone"
    matched = (matched_dater_first_name or "Someone").strip() or "Someone"
    if is_blind_match:
        body = f"{linked} has a new blind match with {matched}"
    else:
        body = f"{linked} has a new match with {matched}"

    data = {
        "type": "blind_match" if is_blind_match else "match",
        "matchId": str(match_id),
        "recipientRole": "matchmaker",
    }
    if linked_dater_id is not None:
        try:
            data["linkedDaterId"] = str(int(linked_dater_id))
        except (TypeError, ValueError):
            pass
    return _deliver_new_match_push(mm_user_id, user, title, body, data)


def send_match_notification_to_linked_matchmakers(
    dater_id,
    match_id,
    counterparty_first_name,
    is_blind_match=False,
    skip_matchmaker_ids=None,
):
    """Fan-out new-match push to matchmakers who manage this dater (devices register under MM user ids)."""
    dater = User.query.get(dater_id)
    linked_dater_first_name = getattr(dater, "first_name", None) if dater else None
    counterparty_name = (counterparty_first_name or "Someone").strip() or "Someone"
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
            linked_dater_first_name,
            counterparty_name,
            is_blind_match=is_blind_match,
            linked_dater_id=dater_id,
        ):
            any_ok = True
    return any_ok


def _deliver_push_to_user_tokens(user_id, user, title, body, data):
    """Deliver a push to all token rows stored under user_id."""
    push_tokens = PushToken.query.filter_by(user_id=user_id).all()

    if not push_tokens:
        if user and user.push_token:
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


def send_approved_match_push_to_dater(
    user_id, title, body, match_id, *, approving_mm_id=None
):
    """
    Push to a specific dater. Tags recipientRole=dater and targetUserId so the client
    routes to the dater account. Delivers to the dater row, their same-email linked
    account, and optionally the approving matchmaker row when approving_mm_id is set.
    """
    user = User.query.get(user_id)
    if not user:
        return False
    if not _user_notification_allowed(user, "new_match_approval_notifications"):
        return False

    data = {
        "type": "match_approval",
        "matchId": str(match_id),
        "recipientRole": "dater",
        "targetUserId": str(int(user_id)),
    }

    any_ok = _deliver_push_to_user_tokens(user_id, user, title, body, data)

    if user.linked_account_id:
        linked = User.query.get(user.linked_account_id)
        if linked and _deliver_push_to_user_tokens(
            linked.id, linked, title, body, data
        ):
            any_ok = True

    if approving_mm_id:
        mm_user = User.query.get(approving_mm_id)
        if mm_user and getattr(mm_user, "role", None) == "matchmaker":
            if _deliver_push_to_user_tokens(approving_mm_id, mm_user, title, body, data):
                any_ok = True

    return any_ok


def send_approved_match_notification(user_id, title, body, match_id, *, linked_dater_id=None):
    """Push when a pending match is approved (matchmakers or daters)."""
    user = User.query.get(user_id)
    if not user:
        return False
    if not _user_notification_allowed(user, "new_match_approval_notifications"):
        return False

    data = {
        "type": "match_approval",
        "matchId": str(match_id),
        "recipientRole": _recipient_role_value(user),
        "targetUserId": str(int(user_id)),
    }
    if linked_dater_id is not None:
        try:
            data["linkedDaterId"] = str(int(linked_dater_id))
        except (TypeError, ValueError):
            pass

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
