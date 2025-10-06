from flask import Blueprint, jsonify, request
from app.models.messageDB import Message
from app.models.conversationDB import Conversation
from app import db
from datetime import datetime
from app.routes.shared import token_required

conversation_bp = Blueprint('conversation', __name__)

@conversation_bp.route('/<int:match_id>', methods=['GET'])
@token_required
def get_matched_conversations(current_user, match_id):
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

    db.session.commit()

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

    return jsonify({
        'id': conversation.id,
        'match_id': conversation.match_id,
        'messages': messages_data
    }), 201
