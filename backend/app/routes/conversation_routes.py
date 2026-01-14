from flask import Blueprint, jsonify, request
from app.models.messageDB import Message
from app.models.conversationDB import Conversation
from app.models.matchDB import Match
from app.models.userDB import User
from app import db
from datetime import datetime
from app.routes.shared import token_required
from app.services.notification_service import send_message_notification

conversation_bp = Blueprint('conversation', __name__)

@conversation_bp.route('/<int:match_id>', methods=['GET'])
@token_required
def get_matched_conversations(current_user, match_id):
    # Check if user has permission to view this conversation
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    # Determine the user ID to check (for matchmakers, use their linked dater)
    check_user_id = current_user.id
    if current_user.role == 'matchmaker':
        if not current_user.referred_by_id:
            return jsonify({'error': 'Matchmaker has no linked dater'}), 403
        check_user_id = current_user.referred_by_id
    
    # For pending_approval matches, only users in liked_by or involved matchmakers can access
    if match.status == 'pending_approval':
        liked_ids = {u.id for u in match.liked_by}
        # Check if user is in liked_by OR if matchmaker is involved in the match
        matchmaker_involved = (current_user.role == 'matchmaker' and 
                              (match.matched_by_user_id_1_matcher == current_user.id or 
                               match.matched_by_user_id_2_matcher == current_user.id))
        if check_user_id not in liked_ids and not matchmaker_involved:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    
    # For matched matches, both users can access
    elif match.status == 'matched':
        if check_user_id not in [match.user_id_1, match.user_id_2]:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    
    # For pending matches, only users in liked_by can access
    else:  # pending status
        liked_ids = {u.id for u in match.liked_by}
        if check_user_id not in liked_ids:
            return jsonify({'error': 'You do not have permission to view this conversation'}), 403
    
    conversation = Conversation.query.filter_by(match_id=match_id).first()
    if not conversation:
        return jsonify([]), 200

    messages_data = [
        {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'text': msg.text,
            'puzzle_type': getattr(msg, 'puzzle_type', None),
            'puzzle_link': getattr(msg, 'puzzle_link', None),
            'timestamp': msg.timestamp.isoformat()
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
    # Check if user has permission to send messages in this conversation
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    # Determine the user ID to check (for matchmakers, use their linked dater)
    check_user_id = current_user.id
    if current_user.role == 'matchmaker':
        if not current_user.referred_by_id:
            return jsonify({'error': 'Matchmaker has no linked dater'}), 403
        check_user_id = current_user.referred_by_id
    
    # For pending_approval matches, only users in liked_by or involved matchmakers can send messages
    if match.status == 'pending_approval':
        liked_ids = {u.id for u in match.liked_by}
        # Check if user is in liked_by OR if matchmaker is involved in the match
        matchmaker_involved = (current_user.role == 'matchmaker' and 
                              (match.matched_by_user_id_1_matcher == current_user.id or 
                               match.matched_by_user_id_2_matcher == current_user.id))
        if check_user_id not in liked_ids and not matchmaker_involved:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    
    # For matched matches, both users can send messages
    elif match.status == 'matched':
        if check_user_id not in [match.user_id_1, match.user_id_2]:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    
    # For pending matches, only users in liked_by can send messages
    else:  # pending status
        liked_ids = {u.id for u in match.liked_by}
        if check_user_id not in liked_ids:
            return jsonify({'error': 'You do not have permission to send messages in this conversation'}), 403
    
    data = request.get_json()
    text = data.get('message')
    puzzle_type = data.get('puzzle_type')
    puzzle_link = data.get('puzzle_link')

    if not text and not puzzle_type:
        return jsonify({"error": "No message or puzzle provided"}), 400

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
            receiver_id=match_id,
            text=text if text else None,
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
                        db.session.rollback()
                        return jsonify({"error": "Waiting for the other matchmaker to approve. You cannot send more messages."}), 400
                elif match.matched_by_user_id_2_matcher == current_user.id:
                    if match.approved_by_matcher_2 and not match.approved_by_matcher_1:
                        db.session.rollback()
                        return jsonify({"error": "Waiting for the other matchmaker to approve. You cannot send more messages."}), 400
            
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

    # Send push notification to the receiver
    # Determine the receiver: the other user in the match
    if match:
        # Determine the actual receiver user ID
        if current_user.role == 'matchmaker':
            # For matchmakers, use their linked dater ID
            sender_user_id = current_user.referred_by_id if current_user.referred_by_id else current_user.id
        else:
            sender_user_id = current_user.id
        
        # Find the other user in the match
        if match.user_id_1 == sender_user_id:
            receiver_user_id = match.user_id_2
        elif match.user_id_2 == sender_user_id:
            receiver_user_id = match.user_id_1
        else:
            # If sender is not directly in the match (e.g., matchmaker), determine receiver from liked_by
            receiver_user_id = None
            for liked_user in match.liked_by:
                if liked_user.id != sender_user_id:
                    receiver_user_id = liked_user.id
                    break
        
        # Send notification if we found a receiver
        if receiver_user_id and (text or puzzle_type):
            message_preview = text if text else f"Sent a {puzzle_type}" if puzzle_type else "You have a new message"
            try:
                send_message_notification(
                    receiver_id=receiver_user_id,
                    sender_id=sender_user_id,
                    match_id=match_id,
                    message_text=message_preview
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
            'puzzle_type': getattr(msg, 'puzzle_type', None),
            'puzzle_link': getattr(msg, 'puzzle_link', None),
            'timestamp': msg.timestamp.isoformat() + "Z"
        }
        for msg in conversation.messages
    ]

    return jsonify({
        'id': conversation.id,
        'match_id': conversation.match_id,
        'messages': messages_data
    }), 201
