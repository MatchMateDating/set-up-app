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
import logging

logger = logging.getLogger(__name__)

# Initialize Expo Push Client
push_client = PushClient()

def send_push_notification(push_token, title, body, data=None):
    """
    Send a push notification to a single device.
    
    Args:
        push_token: Expo push token (string)
        title: Notification title
        body: Notification body
        data: Optional data payload (dict)
    
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    if not push_token:
        return False
    
    try:
        # Create push message
        message = PushMessage(
            to=push_token,
            title=title,
            body=body,
            data=data or {},
            sound='default',
        )
        
        # Send the notification
        response = push_client.publish(message)
        
        # The response is a PushResponse object
        # Check if it was successful
        if response and hasattr(response, 'status'):
            if response.status == 'ok':
                return True
            else:
                logger.warning(f"Failed to send notification: {response}")
                return False
        return True  # If no error was raised, assume success
    except DeviceNotRegisteredError:
        logger.warning(f"Device not registered: {push_token}")
        return False
    except InvalidCredentialsError:
        logger.error("Invalid credentials for push notifications")
        return False
    except PushServerError as e:
        logger.error(f"Push server error: {e}")
        return False
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False

def send_notification_to_user(user_id, title, body, data=None):
    """
    Send a push notification to a user by their user ID.
    Sends to all registered devices for the user.
    
    Args:
        user_id: User ID (int)
        title: Notification title
        body: Notification body
        data: Optional data payload (dict)
    
    Returns:
        bool: True if at least one notification was sent successfully, False otherwise
    """
    user = User.query.get(user_id)
    if not user:
        return False
    
    # Check if user has notifications enabled
    if not user.notifications_enabled:
        return False
    
    # Get all push tokens for this user
    push_tokens = PushToken.query.filter_by(user_id=user_id).all()
    
    if not push_tokens:
        # Fallback to legacy push_token field for backward compatibility
        if user.push_token:
            return send_push_notification(user.push_token, title, body, data)
        return False
    
    # Send to all registered devices
    success_count = 0
    for token_obj in push_tokens:
        if send_push_notification(token_obj.token, title, body, data):
            success_count += 1
    
    return success_count > 0

def send_message_notification(receiver_id, sender_id, match_id, message_text):
    """
    Send a push notification for a new message.
    Sends to all registered devices for the receiver.
    
    Args:
        receiver_id: ID of the user receiving the message
        sender_id: ID of the user sending the message
        match_id: ID of the match/conversation
        message_text: Text of the message (for preview)
    """
    receiver = User.query.get(receiver_id)
    sender = User.query.get(sender_id)
    print(f"receiver {receiver}")
    
    if not receiver:
        return False
    
    # Check if receiver has notifications enabled
    if not receiver.notifications_enabled:
        return False
    
    if not sender:
        return False
    
    sender_name = sender.first_name or 'Someone'
    title = f"New message from {sender_name}"
    # Privacy: Don't send message content in notification to avoid exposing sensitive data on lock screen
    # Users can read the message when they open the app
    body = "You have a new message"
    
    # Data minimization: Only include matchId needed for navigation
    # senderId is not needed - app can fetch sender info when opening conversation
    data = {
        'type': 'message',
        'matchId': str(match_id),
    }
    
    # Get all push tokens for this user
    push_tokens = PushToken.query.filter_by(user_id=receiver_id).all()
    
    if not push_tokens:
        # Fallback to legacy push_token field for backward compatibility
        if receiver.push_token:
            return send_push_notification(receiver.push_token, title, body, data)
        return False
    
    # Send to all registered devices
    success_count = 0
    for token_obj in push_tokens:
        if send_push_notification(token_obj.token, title, body, data):
            success_count += 1
    
    return success_count > 0

def send_match_notification(user_id, match_id, other_user_name):
    """
    Send a push notification for a new match.
    Sends to all registered devices for the user.
    
    Args:
        user_id: ID of the user receiving the match notification
        match_id: ID of the new match
        other_user_name: Name of the matched user
    """
    user = User.query.get(user_id)
    if not user:
        return False
    
    # Check if user has notifications enabled
    if not user.notifications_enabled:
        return False
    
    title = "New Match!"
    body = f"You have a new match with {other_user_name}"
    
    data = {
        'type': 'match',
        'matchId': str(match_id),
    }
    
    # Get all push tokens for this user
    push_tokens = PushToken.query.filter_by(user_id=user_id).all()
    
    if not push_tokens:
        # Fallback to legacy push_token field for backward compatibility
        if user.push_token:
            return send_push_notification(user.push_token, title, body, data)
        return False
    
    # Send to all registered devices
    success_count = 0
    for token_obj in push_tokens:
        if send_push_notification(token_obj.token, title, body, data):
            success_count += 1
    
    return success_count > 0

