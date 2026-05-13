import logging
from flask import Blueprint, jsonify, request
from app.models.messageDB import Message
from app.models.conversationDB import Conversation
from app.models.conversationReadStateDB import ConversationReadState
from app.models.matchDB import Match
from app.models.userDB import User
from app import db
from datetime import datetime, timezone
from app.routes.shared import token_required
from app.services.notification_service import (
    send_message_notification,
    send_dater_removed_matchmaker_sync,
)

logger = logging.getLogger(__name__)
from app.services.conversation_typing import set_typing, active_typer_ids

conversation_bp = Blueprint('conversation', __name__)


def _matchmaker_thread_access(match, matchmaker_user_id):
    """True if this matchmaker user may participate in a pending_approval thread (not removed by their dater)."""
    if not match or not matchmaker_user_id:
        return False
    if match.matched_by_user_id_1_matcher == matchmaker_user_id:
        return not bool(match.dater_removed_matcher_1)
    if match.matched_by_user_id_2_matcher == matchmaker_user_id:
        return not bool(match.dater_removed_matcher_2)
    return False


def _deny_conversation_view(current_user, match):
    """Return Flask (response, status) if viewer cannot access this match thread, else None."""
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    check_user_id = _conversation_user_id(current_user)
    if current_user.role == 'matchmaker' and not current_user.referred_by_id:
        return jsonify({'error': 'Matchmaker has no linked dater'}), 403
    if match.status == 'pending_approval':
        liked_ids = {u.id for u in match.liked_by}
        matchmaker_involved = (
            current_user.role == 'matchmaker' and
            (match.matched_by_user_id_1_matcher == current_user.id or
             match.matched_by_user_id_2_matcher == current_user.id) and
            _matchmaker_thread_access(match, current_user.id)
        )
        if check_user_id not in liked_ids and not matchmaker_involved:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    elif match.status == 'matched':
        # Matchmaker may still mediate this thread even when their *selected* roster dater
        # (referred_by_id) differs — e.g. multi-roster MMs who tapped a push before switching.
        mm_mediated = (
            current_user.role == 'matchmaker'
            and (
                match.matched_by_user_id_1_matcher == current_user.id
                or match.matched_by_user_id_2_matcher == current_user.id
            )
            and _matchmaker_thread_access(match, current_user.id)
        )
        if check_user_id not in [match.user_id_1, match.user_id_2] and not mm_mediated:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    else:
        liked_ids = {u.id for u in match.liked_by}
        if check_user_id not in liked_ids:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    return None


def _deny_conversation_send(current_user, match):
    """Return Flask (response, status) if user cannot send in this thread, else None."""
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    check_user_id = _conversation_user_id(current_user)
    if current_user.role == 'matchmaker' and not current_user.referred_by_id:
        return jsonify({'error': 'Matchmaker has no linked dater'}), 403
    if match.status == 'pending_approval':
        liked_ids = {u.id for u in match.liked_by}
        matchmaker_involved = (
            current_user.role == 'matchmaker' and
            (match.matched_by_user_id_1_matcher == current_user.id or
             match.matched_by_user_id_2_matcher == current_user.id) and
            _matchmaker_thread_access(match, current_user.id)
        )
        side_approved = (
            (check_user_id == match.user_id_1 and bool(match.approved_by_matcher_1)) or
            (check_user_id == match.user_id_2 and bool(match.approved_by_matcher_2))
        )
        if check_user_id not in liked_ids and not matchmaker_involved and not side_approved:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    elif match.status == 'matched':
        mm_mediated = (
            current_user.role == 'matchmaker'
            and (
                match.matched_by_user_id_1_matcher == current_user.id
                or match.matched_by_user_id_2_matcher == current_user.id
            )
            and _matchmaker_thread_access(match, current_user.id)
        )
        if check_user_id not in [match.user_id_1, match.user_id_2] and not mm_mediated:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    else:
        liked_ids = {u.id for u in match.liked_by}
        if check_user_id not in liked_ids:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    return None


def _message_timestamp_utc_iso(dt):
    """Return message timestamp as ISO 8601 string in UTC (with Z suffix) so clients parse as UTC and can show in local time (EST, PST, etc.)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Stored as naive UTC (from datetime.utcnow() or DB NOW() in UTC)
        return dt.isoformat() + 'Z'
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def _conversation_user_id(current_user):
    """Return the dater identity for conversation read/unread semantics."""
    if current_user.role == 'matchmaker' and current_user.referred_by_id:
        return current_user.referred_by_id
    return current_user.id

@conversation_bp.route('/<int:match_id>', methods=['GET'])
@token_required
def get_matched_conversations(current_user, match_id):
    match = Match.query.get(match_id)
    denied = _deny_conversation_view(current_user, match)
    if denied:
        return denied

    conversation = Conversation.query.filter_by(match_id=match_id).first()
    if not conversation:
        return jsonify([]), 200

    messages_data = [
        {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'text': msg.text,
            'read': bool(getattr(msg, 'read', False)),
            'puzzle_type': getattr(msg, 'puzzle_type', None),
            'puzzle_link': getattr(msg, 'puzzle_link', None),
            'timestamp': _message_timestamp_utc_iso(msg.timestamp)
        }
        for msg in conversation.messages
    ]

    return jsonify([{
        'id': conversation.id,
        'match_id': conversation.match_id,
        'messages': messages_data
    }]), 200


# POST a text message to conversation
@conversation_bp.route('/<int:match_id>', methods=['POST'])
@token_required
def add_to_conversation(current_user, match_id):
    match = Match.query.get(match_id)
    denied = _deny_conversation_send(current_user, match)
    if denied:
        return denied

    data = request.get_json()
    text = data.get('message')
    puzzle_type = data.get('puzzle_type')
    puzzle_link = data.get('puzzle_link')

    if not text and not puzzle_type:
        return jsonify({"error": "No message or puzzle provided"}), 400

    if current_user.role == 'matchmaker':
        sender_user_id = current_user.referred_by_id if current_user.referred_by_id else current_user.id
    else:
        sender_user_id = current_user.id

    if match.user_id_1 == sender_user_id:
        receiver_user_id = match.user_id_2
    elif match.user_id_2 == sender_user_id:
        receiver_user_id = match.user_id_1
    else:
        receiver_user_id = None
        for liked_user in match.liked_by:
            if liked_user.id != sender_user_id:
                receiver_user_id = liked_user.id
                break

    # Fetch or create conversation
    conversation = Conversation.query.filter_by(match_id=match_id).first()
    if not conversation:
        conversation = Conversation(match_id=match_id)
        db.session.add(conversation)
        db.session.flush()  # assign conversation.id

    # Add text message if provided
    if text or puzzle_type:
        message = Message(
            conversation_id=conversation.id,
            sender_id=current_user.id,
            receiver_id=receiver_user_id,
            text=text if text else None,
            read=False,
            puzzle_type=puzzle_type if puzzle_type else None,
            puzzle_link=puzzle_link if puzzle_link else None,
            timestamp=datetime.utcnow()
        )
        db.session.add(message)
        
        # If matchmaker is sending message to pending_approval match, increment message count
        match = Match.query.get(match_id)
        if match and match.status == 'pending_approval' and current_user.role == 'matchmaker':
            # Check if both matchmakers are involved and if one has approved but not the other
            both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
            
            if both_matchmakers_involved:
                # Check if this matchmaker has approved but the other hasn't
                if match.matched_by_user_id_1_matcher == current_user.id:
                    if match.approved_by_matcher_1 and not match.approved_by_matcher_2:
                        # After approving, MM can only send puzzles (no freeform text) until the other MM approves.
                        if text:
                            db.session.rollback()
                            return jsonify({"error": "Waiting for the other matchmaker to approve. You can only send puzzles."}), 400
                elif match.matched_by_user_id_2_matcher == current_user.id:
                    if match.approved_by_matcher_2 and not match.approved_by_matcher_1:
                        if text:
                            db.session.rollback()
                            return jsonify({"error": "Waiting for the other matchmaker to approve. You can only send puzzles."}), 400
            
            # Check if this matchmaker is involved
            if match.matched_by_user_id_1_matcher == current_user.id:
                # This matchmaker is on user_id_1 side
                match.message_count_matcher_1 = (match.message_count_matcher_1 or 0) + 1
                # Enforce 10 message limit - don't allow sending if limit reached
                if match.message_count_matcher_1 > 10:
                    db.session.rollback()
                    return jsonify({"error": "Message limit reached. Please approve the match to continue."}), 400
            elif match.matched_by_user_id_2_matcher == current_user.id:
                # This matchmaker is on user_id_2 side
                match.message_count_matcher_2 = (match.message_count_matcher_2 or 0) + 1
                # Enforce 10 message limit - don't allow sending if limit reached
                if match.message_count_matcher_2 > 10:
                    db.session.rollback()
                    return jsonify({"error": "Message limit reached. Please approve the match to continue."}), 400
            # Legacy support: if only one matchmaker (old data), use message_count
            elif not match.matched_by_user_id_1_matcher and not match.matched_by_user_id_2_matcher:
                match.message_count = (match.message_count or 0) + 1
                if match.message_count > 10:
                    db.session.rollback()
                    return jsonify({"error": "Message limit reached. Please approve the match to continue."}), 400

    db.session.commit()

    # Send push notification to the receiver (receiver_user_id already computed above)
    if match and (text or puzzle_type):
        message_preview = text if text else f"Sent a {puzzle_type}" if puzzle_type else "You have a new message"
        try:
            send_message_notification(
                receiver_id=receiver_user_id,
                sender_id=sender_user_id,
                match_id=match_id,
                message_text=message_preview,
                auth_sender_id=current_user.id,
                puzzle_type=puzzle_type,
            )
        except Exception as e:
            # Log error but don't fail the request
            print(f"Error sending push notification: {e}")

    messages_data = [
        {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'text': msg.text,
            'read': bool(getattr(msg, 'read', False)),
            'puzzle_type': getattr(msg, 'puzzle_type', None),
            'puzzle_link': getattr(msg, 'puzzle_link', None),
            'timestamp': _message_timestamp_utc_iso(msg.timestamp)
        }
        for msg in conversation.messages
    ]

    return jsonify({
        'id': conversation.id,
        'match_id': conversation.match_id,
        'messages': messages_data
    }), 201


@conversation_bp.route('/<int:match_id>/read', methods=['POST'])
@token_required
def mark_conversation_read(current_user, match_id):
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    check_user_id = _conversation_user_id(current_user)
    if current_user.role == 'matchmaker' and not current_user.referred_by_id:
        return jsonify({'error': 'Matchmaker has no linked dater'}), 403

    if match.status == 'pending_approval':
        liked_ids = {u.id for u in match.liked_by}
        matchmaker_involved = (
            current_user.role == 'matchmaker' and
            (match.matched_by_user_id_1_matcher == current_user.id or
             match.matched_by_user_id_2_matcher == current_user.id) and
            _matchmaker_thread_access(match, current_user.id)
        )
        if check_user_id not in liked_ids and not matchmaker_involved:
            return jsonify({'error': 'You do not have permission to update this conversation'}), 403
    elif match.status == 'matched':
        mm_mediated = (
            current_user.role == 'matchmaker'
            and (
                match.matched_by_user_id_1_matcher == current_user.id
                or match.matched_by_user_id_2_matcher == current_user.id
            )
            and _matchmaker_thread_access(match, current_user.id)
        )
        if check_user_id not in [match.user_id_1, match.user_id_2] and not mm_mediated:
            return jsonify({'error': 'You do not have permission to update this conversation'}), 403
    else:
        liked_ids = {u.id for u in match.liked_by}
        if check_user_id not in liked_ids:
            return jsonify({'error': 'You do not have permission to update this conversation'}), 403

    conversation = Conversation.query.filter_by(match_id=match_id).first()
    if not conversation:
        return jsonify({'updated': 0}), 200

    latest_message = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.desc()).first()
    if not latest_message:
        return jsonify({'updated': 0}), 200

    read_state = ConversationReadState.query.filter_by(
        conversation_id=conversation.id,
        viewer_user_id=current_user.id
    ).first()
    if not read_state:
        read_state = ConversationReadState(
            conversation_id=conversation.id,
            viewer_user_id=current_user.id,
            last_read_message_id=latest_message.id
        )
        db.session.add(read_state)
    else:
        read_state.last_read_message_id = latest_message.id

    db.session.commit()
    return jsonify({'updated': 1}), 200


@conversation_bp.route('/<int:match_id>/remove-my-matchmaker', methods=['POST'])
@token_required
def remove_my_matchmaker_from_conversation(current_user, match_id):
    """Dater-only: revoke their own side's matchmaker from the mediated thread (pending approval or matched)."""
    if current_user.role != 'user':
        return jsonify({'message': 'Only daters can remove their matchmaker from the conversation.'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'message': 'Match not found.'}), 404
    if match.status not in ('pending_approval', 'matched'):
        return jsonify({'message': 'This action is not available for this match.'}), 400

    removed_mm_user_id = None
    if current_user.id == match.user_id_1:
        if not match.matched_by_user_id_1_matcher:
            return jsonify({'message': 'There is no matchmaker on your side to remove.'}), 400
        if match.status == 'pending_approval' and not match.approved_by_matcher_1:
            return jsonify({'message': 'Your matchmaker has not approved yet; you cannot remove them yet.'}), 400
        if match.dater_removed_matcher_1:
            return jsonify({'message': 'Already removed.', 'dater_removed_matcher_1': True}), 200
        removed_mm_user_id = match.matched_by_user_id_1_matcher
        match.dater_removed_matcher_1 = True
    elif current_user.id == match.user_id_2:
        if not match.matched_by_user_id_2_matcher:
            return jsonify({'message': 'There is no matchmaker on your side to remove.'}), 400
        if match.status == 'pending_approval' and not match.approved_by_matcher_2:
            return jsonify({'message': 'Your matchmaker has not approved yet; you cannot remove them yet.'}), 400
        if match.dater_removed_matcher_2:
            return jsonify({'message': 'Already removed.', 'dater_removed_matcher_2': True}), 200
        removed_mm_user_id = match.matched_by_user_id_2_matcher
        match.dater_removed_matcher_2 = True
    else:
        return jsonify({'message': 'You are not part of this match.'}), 403

    db.session.commit()
    if removed_mm_user_id:
        try:
            send_dater_removed_matchmaker_sync(match.id, removed_mm_user_id)
        except Exception as e:
            logger.warning('send_dater_removed_matchmaker_sync failed: %s', e)

    return jsonify({
        'message': 'Your matchmaker can no longer view or participate in this conversation.',
        'dater_removed_matcher_1': bool(match.dater_removed_matcher_1),
        'dater_removed_matcher_2': bool(match.dater_removed_matcher_2),
    }), 200


@conversation_bp.route('/<int:match_id>/typing', methods=['GET', 'POST'])
@token_required
def conversation_typing(current_user, match_id):
    match = Match.query.get(match_id)
    if request.method == 'GET':
        denied = _deny_conversation_view(current_user, match)
        if denied:
            return denied
        ids = active_typer_ids(match_id, exclude_user_id=current_user.id)
        typing_users = []
        for uid in ids:
            u = User.query.get(uid)
            if u:
                if (
                    match
                    and match.status == 'pending_approval'
                    and (u.role or '') == 'matchmaker'
                    and not _matchmaker_thread_access(match, u.id)
                ):
                    continue
                typing_users.append({
                    'user_id': u.id,
                    'first_name': u.first_name or '',
                    'role': u.role or 'user',
                })
        return jsonify({'typing': typing_users}), 200

    denied = _deny_conversation_send(current_user, match)
    if denied:
        return denied
    data = request.get_json(silent=True) or {}
    set_typing(match_id, current_user.id, bool(data.get('typing')))
    return jsonify({'ok': True}), 200
