from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app.models.messageDB import Message
from functools import wraps
from app import db
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from app.models.conversationDB import Conversation
from datetime import datetime
import logging

conversation_bp = Blueprint('conversation', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Verify the JWT token
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            
            if not user_id:
                return jsonify({'message': 'Invalid token: no user identity'}), 401
            
            # Get current user
            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({'message': 'User not found'}), 404
                
            # Check if user is still active/enabled
            if not getattr(current_user, 'is_active', True):
                return jsonify({'message': 'Account deactivated'}), 403
                
            return f(current_user, *args, **kwargs)
            
        except ExpiredSignatureError:
            return jsonify({
                'message': 'Token has expired',
                'error_code': 'TOKEN_EXPIRED',
                'refresh_required': True
            }), 401
            
        except InvalidTokenError as e:
            return jsonify({
                'message': f'Invalid token: {str(e)}',
                'error_code': 'INVALID_TOKEN'
            }), 401
            
        except Exception as e:
            print(f"Unexpected JWT error: {str(e)}")
            return jsonify({
                'message': 'Authentication failed',
                'error_code': 'AUTH_ERROR'
            }), 401
            
    return decorated


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
