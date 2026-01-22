from flask import Blueprint, request, jsonify
from app.models import db, User
from flask_jwt_extended import create_access_token
from flask import current_app
from datetime import datetime, timedelta
import boto3
import os
import re
from twilio.rest import Client

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# AWS SES client helper (reused from invite_routes pattern)
def get_ses_client():
    """Get SES client, handling AWS_PROFILE if set"""
    aws_profile = os.getenv("AWS_PROFILE")
    client_kwargs = {}
    
    # Add region if provided
    if os.getenv("AWS_REGION"):
        client_kwargs["region_name"] = os.getenv("AWS_REGION")
    
    # Add explicit credentials if provided
    if os.getenv("SES_SNS_KEY") and os.getenv("SES_SNS_SECRET"):
        client_kwargs["aws_access_key_id"] = os.getenv("SES_SNS_KEY")
        client_kwargs["aws_secret_access_key"] = os.getenv("SES_SNS_SECRET")
    
    # Use AWS_PROFILE if set and not empty, otherwise use default credentials
    if aws_profile:
        session = boto3.Session(profile_name=aws_profile)
        return session.client("ses", **client_kwargs)
    else:
        return boto3.client("ses", **client_kwargs)

def get_twilio_client():
    """Get Twilio client"""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if account_sid and auth_token:
        return Client(account_sid, auth_token)
    return None

def send_verification_sms(phone_number, verification_token, first_name):
    """Send verification SMS using Twilio"""
    try:
        client = get_twilio_client()
        if not client:
            print("Twilio credentials not configured")
            return False
        
        twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
        if not twilio_phone:
            print("TWILIO_PHONE_NUMBER not configured")
            return False

        print('twilio phone', twilio_phone)
        
        message_body = f"Hello {first_name or 'there'}, your verification code is: {verification_token}. If you didn't create an account, please ignore this message."
        
        message = client.messages.create(
            body=message_body,
            from_=twilio_phone,
            to=phone_number
        )
        print(f"Verification SMS sent to {phone_number}: {message.sid}")
        return True
    except Exception as e:
        print(f"Error sending verification SMS: {str(e)}")
        return False

def send_verification_email(email, verification_token, first_name):
    """Send verification email using AWS SES"""
    try:
        ses = get_ses_client()
        sender_email = os.getenv("SES_SENDER_EMAIL")
        
        # Build verification URL (for mobile app, this could be a deep link or API endpoint)
        # For now, we'll use a code-based verification
        verification_url = f"{os.getenv('API_BASE_URL', 'http://localhost:5000')}/auth/verify-email?token={verification_token}"
        
        # Email content
        subject = "Verify Your Email Address"
        body_text = f"""Hello {first_name or 'there'},
            Please verify your email address by clicking the link below or entering the verification code in the app:

            Verification Code: {verification_token}

            If you didn't create an account, please ignore this email.

            Best regards,
            The Team"""
        
        body_html = f"""<html>
            <head></head>
            <body>
              <h2>Hello {first_name or 'there'},</h2>
              <p>Please verify your email address by clicking the link below or entering the verification code in the app:</p>
              <p><strong>Verification Code: {verification_token}</strong></p>
              <p>If you didn't create an account, please ignore this email.</p>
              <p>Best regards,<br>The Team</p>
            </body>
            </html>"""
        
        response = ses.send_email(
            Source=sender_email,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Text": {"Data": body_text},
                    "Html": {"Data": body_html}
                },
            },
        )
        print(f"Verification email sent to {email}: {response.get('MessageId')}")
        return True
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        return False

def is_email(value):
    """Check if value is an email address"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_pattern, value) is not None

def normalize_phone_number(phone):
    """Normalize phone number to E.164 format"""
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    # If doesn't start with country code, assume US (+1)
    if not digits.startswith('1') and len(digits) == 10:
        digits = '1' + digits
    if not digits.startswith('+'):
        digits = '+' + digits
    return digits

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    print(f"Received data: {data}")
    
    # Require either email OR phone_number (not both, at least one)
    email = data.get('email')
    phone_number = data.get('phone_number')
    password = data.get('password')
    
    if not email and not phone_number:
        return jsonify({'msg': 'Either email or phone_number is required'}), 400

    if not password:
        return jsonify({'msg':'Please enter a password'}), 400
    
    # Normalize phone number if provided
    if phone_number:
        phone_number = normalize_phone_number(phone_number)
    
    # Check for existing user with same email or phone
    if email:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'msg': 'Email already registered'}), 400
    else:
        existing_user = User.query.filter_by(phone_number=phone_number).first()
        if existing_user:
            return jsonify({'msg': 'Phone number already registered'}), 400
    
    role = data.get('role', 'user')  # default is normal user
    print(f"Resolved role: {role}")
    referred_by = None

    if role == 'matchmaker':
        referral_code = data.get('referral_code')
        if not referral_code:
            return jsonify({'msg': 'Referral code required for matchmaker'}), 400

        referrer = User.query.filter_by(referral_code=referral_code).first()
        if not referrer:
            return jsonify({'msg': 'Invalid referral code'}), 400

        referred_by = referrer.id

    user = User(
        email=email,
        phone_number=phone_number,
        role=role,
        first_name=None,
        last_name=None,
        referred_by_id=referred_by)
    user.set_password(data['password'])

    if role == 'user':
        user.referral_code = user.generate_referral_code()

    # Generate verification token
    verification_token = user.generate_verification_token()
    verification_sent = False
    
    if email:
        user.email_verification_token = verification_token
        user.email_verified = False
        verification_sent = send_verification_email(email, verification_token, user.first_name)
        if not verification_sent:
            print(f"Warning: Failed to send verification email to {email}")
    else:
        user.phone_verification_token = verification_token
        user.phone_verified = False
        verification_sent = send_verification_sms(phone_number, verification_token, user.first_name)
        if not verification_sent:
            print(f"Warning: Failed to send verification SMS to {phone_number}")
    
    # Set last_active_at for newly created account
    user.last_active_at = datetime.utcnow()

    db.session.add(user)
    db.session.commit()

    # Return user without token - user needs to verify first
    method = 'email' if email else 'phone'
    return jsonify({
        'message': f'User created successfully. Please verify your {method}.', 
        'user': user.to_dict(),
        'verification_sent': verification_sent,
        'verification_method': method}), 200

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    identifier = data.get('email') or data.get('phone_number') or data.get('identifier')
    password = data.get('password')
    
    if not identifier or not password:
        return jsonify({'error': 'Email/phone number and password are required'}), 400
    
    # Determine if identifier is email or phone
    if is_email(identifier):
        # Login with email
        users = User.query.filter_by(email=identifier).all()
    else:
        # Login with phone number (normalize it)
        phone_number = normalize_phone_number(identifier)
        users = User.query.filter_by(phone_number=phone_number).all()
    
    # Find all users with matching password
    matching_users = []
    for u in users:
        if u.check_password(password):
            matching_users.append(u)
    
    if not matching_users:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # If multiple accounts match, prefer the one that was last active
    # Sort by last_active_at (most recent first), with None values treated as oldest
    matching_users.sort(key=lambda u: u.last_active_at if u.last_active_at else datetime.min, reverse=True)
    user = matching_users[0]
    
    # Update last_active_at to current time
    user.last_active_at = datetime.utcnow()
    db.session.commit()
    
    token = create_access_token(identity=str(user.id))
    response_data = {
        'message': 'Login successful', 
        'user': user.to_dict(),
        'token': token
    }
    
    # Add warning if verification is needed (but still allow login)
    if user.email and not user.email_verified:
        response_data['warning'] = 'Please verify your email address'
    elif user.phone_number and not user.phone_verified:
        response_data['warning'] = 'Please verify your phone number'
    
    return jsonify(response_data), 200

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """Verify email or phone using verification token"""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'msg': 'Verification token is required'}), 400
    
    # Try to find user by email verification token
    user = User.query.filter_by(email_verification_token=token).first()
    verification_method = 'email'
    
    # If not found, try phone verification token
    if not user:
        user = User.query.filter_by(phone_verification_token=token).first()
        verification_method = 'phone'
    
    if not user:
        return jsonify({'msg': 'Invalid or expired verification token'}), 400
    
    # Verify based on method
    if verification_method == 'email':
        if user.email_verified:
            return jsonify({'msg': 'Email already verified', 'user': user.to_dict()}), 200
        user.email_verified = True
        user.email_verification_token = None
    else:
        if user.phone_verified:
            return jsonify({'msg': 'Phone number already verified', 'user': user.to_dict()}), 200
        user.phone_verified = True
        user.phone_verification_token = None
    
    db.session.commit()
    
    # Create access token for verified user
    access_token = create_access_token(identity=str(user.id))
    
    method_text = 'Email' if verification_method == 'email' else 'Phone number'
    return jsonify({
        'message': f'{method_text} verified successfully',
        'user': user.to_dict(),
        'token': access_token
    }), 200

@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification email or SMS"""
    data = request.get_json()
    email = data.get('email')
    phone_number = data.get('phone_number')
    
    if not email and not phone_number:
        return jsonify({'msg': 'Email or phone_number is required'}), 400
    
    if email and phone_number:
        return jsonify({'msg': 'Please provide either email or phone_number, not both'}), 400
    
    user = None
    verification_method = None
    
    if email:
        # Find user by email (get the most recent one if multiple exist)
        users = User.query.filter_by(email=email).all()
        if not users:
            return jsonify({'msg': 'User not found'}), 404
        user = max(users, key=lambda u: u.id)
        verification_method = 'email'
        if user.email_verified:
            return jsonify({'msg': 'Email already verified'}), 400
        if not user.email_verification_token:
            user.email_verification_token = user.generate_verification_token()
            db.session.commit()
        verification_sent = send_verification_email(
            user.email,
            user.email_verification_token,
            user.first_name
        )
        if not verification_sent:
            return jsonify({'msg': 'Failed to send verification email'}), 500
    else:
        # Normalize phone number
        phone_number = normalize_phone_number(phone_number)
        users = User.query.filter_by(phone_number=phone_number).all()
        if not users:
            return jsonify({'msg': 'User not found'}), 404
        user = max(users, key=lambda u: u.id)
        verification_method = 'phone'
        if user.phone_verified:
            return jsonify({'msg': 'Phone number already verified'}), 400
        if not user.phone_verification_token:
            user.phone_verification_token = user.generate_verification_token()
            db.session.commit()
        verification_sent = send_verification_sms(
            user.phone_number,
            user.phone_verification_token,
            user.first_name
        )
        if not verification_sent:
            return jsonify({'msg': 'Failed to send verification SMS'}), 500
    
    method_text = 'email' if verification_method == 'email' else 'SMS'
    return jsonify({
        'message': f'Verification {method_text} sent successfully',
        'verification_sent': True,
        'verification_method': verification_method
    }), 200

def send_password_reset_email(email, reset_token, first_name):
    """Send password reset email using AWS SES"""
    try:
        ses = get_ses_client()
        sender_email = os.getenv("SES_SENDER_EMAIL")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset Your Password"
        body_text = f"""Hello {first_name or 'there'},
        
You requested to reset your password. Click the link below to reset it:

{reset_url}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The Team"""
        
        body_html = f"""<html>
            <head></head>
            <body>
              <h2>Hello {first_name or 'there'},</h2>
              <p>You requested to reset your password. Click the link below to reset it:</p>
              <p><a href="{reset_url}" style="background-color: #6B46C1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
              <p>Or copy and paste this link into your browser:</p>
              <p>{reset_url}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request a password reset, please ignore this email.</p>
              <p>Best regards,<br>The Team</p>
            </body>
            </html>"""
        
        response = ses.send_email(
            Source=sender_email,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Text": {"Data": body_text},
                    "Html": {"Data": body_html}
                },
            },
        )
        print(f"Password reset email sent to {email}: {response.get('MessageId')}")
        return True
    except Exception as e:
        print(f"Error sending password reset email: {str(e)}")
        return False

def send_password_reset_sms(phone_number, reset_token, first_name):
    """Send password reset SMS using Twilio"""
    try:
        client = get_twilio_client()
        if not client:
            print("Twilio credentials not configured")
            return False
        
        twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
        if not twilio_phone:
            print("TWILIO_PHONE_NUMBER not configured")
            return False
        
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        message_body = f"Hello {first_name or 'there'}, you requested to reset your password. Click this link: {reset_url} This link expires in 1 hour. If you didn't request this, please ignore."
        
        message = client.messages.create(
            body=message_body,
            from_=twilio_phone,
            to=phone_number
        )
        print(f"Password reset SMS sent to {phone_number}: {message.sid}")
        return True
    except Exception as e:
        print(f"Error sending password reset SMS: {str(e)}")
        return False

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset - sends email or SMS with reset link"""
    data = request.get_json()
    identifier = data.get('identifier')
    
    if not identifier:
        return jsonify({'msg': 'Email or phone number is required'}), 400
    
    # Determine if identifier is email or phone
    if is_email(identifier):
        user = User.query.filter_by(email=identifier).first()
        method = 'email'
    else:
        phone_number = normalize_phone_number(identifier)
        user = User.query.filter_by(phone_number=phone_number).first()
        method = 'phone'
    
    # Don't reveal if user exists or not (security best practice)
    if not user:
        return jsonify({
            'message': 'If an account exists with that email or phone number, password reset instructions have been sent.'
        }), 200
    
    # Generate reset token
    reset_token = user.generate_password_reset_token()
    user.password_reset_token = reset_token
    user.password_reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    
    # Send reset link via email or SMS
    if method == 'email':
        sent = send_password_reset_email(user.email, reset_token, user.first_name)
    else:
        sent = send_password_reset_sms(user.phone_number, reset_token, user.first_name)
    
    if not sent:
        return jsonify({'msg': 'Failed to send reset instructions. Please try again later.'}), 500
    
    return jsonify({
        'message': 'If an account exists with that email or phone number, password reset instructions have been sent.'
    }), 200

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using reset token"""
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')
    
    if not token or not new_password:
        return jsonify({'msg': 'Token and password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'msg': 'Password must be at least 6 characters long'}), 400
    
    # Find user by reset token
    user = User.query.filter_by(password_reset_token=token).first()
    
    if not user:
        return jsonify({'msg': 'Invalid or expired reset token'}), 400
    
    # Check if token has expired
    if user.password_reset_token_expires and user.password_reset_token_expires < datetime.utcnow():
        user.password_reset_token = None
        user.password_reset_token_expires = None
        db.session.commit()
        return jsonify({'msg': 'Reset token has expired. Please request a new one.'}), 400
    
    # Reset password
    user.set_password(new_password)
    user.password_reset_token = None
    user.password_reset_token_expires = None
    db.session.commit()
    
    return jsonify({'message': 'Password reset successfully'}), 200
