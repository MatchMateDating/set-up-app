from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app.models.messageDB import Message
from app import db
from app.models.conversationDB import Conversation
from datetime import datetime
from app.routes.shared import token_required

conversation_bp = Blueprint('conversation', __name__)

@conversation_bp.route('/<int:match_id>', methods=['GET'])
@token_required
def get_matched_conversations(current_user, match_id):
    if current_user.role == 'user':
        conversations = Conversation.query.filter_by(match_id=match_id).all()
        result = []
        for conv in conversations:
            conv_data = {
                'id': conv.id,
                'match_id': conv.match_id,
                'messages': [
                    {
                        'id': msg.id,
                        'sender_id': msg.sender_id,
                        'text': msg.text,
                        'timestamp': msg.timestamp.isoformat()
                    }
                    for msg in conv.messages
                ]
            }
            result.append(conv_data)

        return jsonify(result), 200
    
@conversation_bp.route('/<int:match_id>', methods=['POST'])
@token_required
def add_to_conversation(current_user, match_id):
    if current_user.role == 'user':
        data = request.get_json()

        conversation = Conversation.query.filter_by(match_id=match_id).first()
        if not conversation:
            conversation = Conversation(match_id=match_id)
            db.session.add(conversation)
            db.session.flush()

        if message := data['message']:
            message = Message(
                conversation_id=conversation.id,
                sender_id=current_user.id,
                text=message,
                timestamp=datetime.utcnow()
            )
            db.session.add(message)
        
        db.session.commit()

        return jsonify({
            'id': conversation.id,
            'match_id': conversation.match_id,
            'messages': [
                {
                    'id': msg.id,
                    'sender_id': msg.sender_id,
                    'text': msg.text,
                    'timestamp': msg.timestamp.isoformat()
                }
                for msg in conversation.messages
            ]
        }), 201
