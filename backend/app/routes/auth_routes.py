from flask import Blueprint, request, jsonify
from app.models import db, User
from app.models.userDB import ReferredUsers
from app.dater_invite_tokens import decode_matchmaker_dater_invite
from flask_jwt_extended import create_access_token
from flask import current_app
from datetime import datetime, timedelta
import resend
import os
import re
from twilio.rest import Client

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Test mode configuration
def is_test_mode_enabled():
    """Check if test mode is enabled"""
    return os.getenv('TEST_MODE_ENABLED', '').lower() in ('true', '1', 'yes')

def get_test_email_domains():
    """Get list of test email domains from environment variable"""
    domains_str = os.getenv('TEST_EMAIL_DOMAINS', '')
    if not domains_str:
        # Default test domains if none specified
        return ['@test.com', '@example.com']
    return [d.strip() for d in domains_str.split(',') if d.strip()]

def is_test_email(email):
    """Check if an email is a test email"""
    if not email or not is_test_mode_enabled():
        return False
    test_domains = get_test_email_domains()
    return any(email.lower().endswith(domain.lower()) for domain in test_domains)

# Initialize Resend API key
resend.api_key = os.getenv("RESEND_API_KEY")
SENDER_EMAIL = "donotreply@matchmatedating.com"

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
    """Send verification email using Resend"""
    try:
        subject = "Verify Your Email Address"
        body_html = f"""<html>
            <head></head>
            <body>
              <h2>Hello {first_name or 'there'},</h2>
              <p>Please verify your email address by entering the verification code in the app:</p>
              <p><strong>Verification Code: {verification_token}</strong></p>
              <p>If you didn't create an account, please ignore this email.</p>
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""
        
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": subject,
            "html": body_html,
        })
        print(f"Verification email sent to {email}: {response.get('id')}")
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

def is_strong_password(password):
    """Password policy: 8+ chars, uppercase, lowercase, special char"""
    if not password or len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[^A-Za-z0-9]', password):
        return False
    return True


_SELF_MATCHMAKE_MSG = "You can't matchmake for yourself."


def accounts_share_identity(user_a, user_b):
    """True when two accounts represent the same person (linked pair or same email/phone)."""
    if not user_a or not user_b:
        return False
    if user_a.id == user_b.id:
        return True
    if user_a.linked_account_id and user_a.linked_account_id == user_b.id:
        return True
    if user_b.linked_account_id and user_b.linked_account_id == user_a.id:
        return True

    email_a = (user_a.email or '').strip().lower()
    email_b = (user_b.email or '').strip().lower()
    if email_a and email_b and email_a == email_b:
        return True

    phone_a = (user_a.phone_number or '').strip()
    phone_b = (user_b.phone_number or '').strip()
    if phone_a and phone_b:
        try:
            if normalize_phone_number(phone_a) == normalize_phone_number(phone_b):
                return True
        except Exception:
            if phone_a == phone_b:
                return True
    return False


def matchmaker_cannot_link_dater_error(matchmaker, dater):
    """Return an error message when a matchmaker cannot link this dater to their roster."""
    if not matchmaker or not dater:
        return None
    if not accounts_share_identity(matchmaker, dater):
        return None
    if (
        matchmaker.linked_account_id == dater.id
        or dater.linked_account_id == matchmaker.id
    ):
        return "You can't add your own linked account to your matchmaker roster. Switch accounts instead."
    return _SELF_MATCHMAKE_MSG


def link_dater_to_matchmaker(matchmaker, dater):
    """Link a dater to a matchmaker's referral row if possible."""
    link_err = matchmaker_cannot_link_dater_error(matchmaker, dater)
    if link_err:
        return {"linked": False, "already_linked": False, "slot": None, "error": link_err}

    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        referral_row = ReferredUsers(matchmaker_id=matchmaker.id)
        db.session.add(referral_row)
        db.session.flush()

    for i in range(1, 11):
        existing = getattr(referral_row, f"linked_dater_{i}_id")
        if existing == dater.id:
            return {"linked": True, "already_linked": True, "slot": i}

    for i in range(1, 11):
        col = f"linked_dater_{i}_id"
        if getattr(referral_row, col) is None:
            setattr(referral_row, col, dater.id)
            return {"linked": True, "already_linked": False, "slot": i}

    return {"linked": False, "already_linked": False, "slot": None}


def matchmaker_already_linked_dater_error(matchmaker, dater):
    """Return an error message if dater is already in matchmaker's linked roster."""
    if not matchmaker or not dater:
        return None
    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        return None
    for i in range(1, 11):
        if getattr(referral_row, f'linked_dater_{i}_id') == dater.id:
            return 'This dater is already linked to your matchmaker account.'
    return None


def resolve_matchmaker_referral(referral_code):
    """Non-empty referral must match a user. Returns (error_msg, referred_by_id)."""
    normalized = (referral_code or '').strip()
    if not normalized:
        return None, None
    referrer = User.query.filter_by(referral_code=normalized).first()
    if not referrer:
        return 'Invalid referral code', None
    return None, referrer.id


def self_matchmaker_referral_error(referral_code, signup_email, signup_phone=None):
    """If referral belongs to a dater, block when signup identity matches that dater."""
    normalized = (referral_code or '').strip()
    if not normalized:
        return None
    referrer = User.query.filter_by(referral_code=normalized).first()
    if not referrer or referrer.role != 'user':
        return None

    signup_email = (signup_email or '').strip().lower()
    ref_email = (referrer.email or '').strip().lower()
    if signup_email and ref_email and signup_email == ref_email:
        return _SELF_MATCHMAKE_MSG

    if signup_phone:
        try:
            signup_norm = normalize_phone_number(signup_phone)
            ref_phone = (referrer.phone_number or '').strip()
            if ref_phone and normalize_phone_number(ref_phone) == signup_norm:
                return _SELF_MATCHMAKE_MSG
        except Exception:
            pass

    return None


def resolve_existing_user_for_email(email):
    """Pick existing account by role preference for web matchmaker signup."""
    users = User.query.filter_by(email=email).all()
    if not users:
        return None, None, None

    matchmaker = next((u for u in users if u.role == 'matchmaker'), None)
    dater = next((u for u in users if u.role == 'user'), None)
    selected = matchmaker or dater or users[0]
    return selected, matchmaker, dater

def get_remember_me_flag(payload):
    """Return whether caller requested a persistent session."""
    payload = payload or {}
    return (
        payload.get('remember_me') is True or
        payload.get('rememberMe') is True or
        payload.get('stay_signed_in') is True or
        payload.get('staySignedIn') is True
    )


@auth_bp.route('/validate-matchmaker-referral', methods=['POST'])
def validate_matchmaker_referral():
    """Check referral code before matchmaker continues signup (optional field; empty is not validated)."""
    data = request.get_json() or {}
    err, _ = resolve_matchmaker_referral(data.get('referral_code'))
    if err:
        return jsonify({'msg': err}), 400
    return jsonify({'ok': True}), 200


@auth_bp.route('/register', methods=['POST'])
def register():
    """Send verification code without creating user account"""
    print('registering')
    data = request.get_json() or {}
    print(f"Received data: {data}")
    remember_me = get_remember_me_flag(data)

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
            return jsonify({'msg': 'A user with this email already exists, please log in'}), 400
    else:
        existing_user = User.query.filter_by(phone_number=phone_number).first()
        if existing_user:
            return jsonify({'msg': 'A user with this phone number already exists, please log in'}), 400

    role = data.get('role', 'user')  # default is normal user
    print(f"Resolved role: {role}")

    # Check if this is a test email and test mode is enabled
    test_mode_enabled = is_test_mode_enabled()
    is_test = email and is_test_email(email)
    
    print(f"TEST MODE DEBUG: test_mode_enabled={test_mode_enabled}, email={email}, is_test={is_test}")
    if email:
        test_domains = get_test_email_domains()
        print(f"TEST MODE DEBUG: test_domains={test_domains}")
    
    if is_test:
        # For test emails, create user immediately without verification
        print(f"TEST MODE: Auto-creating account for test email: {email}")
        
        # Handle referral code for matchmakers (optional).
        referred_by = None
        if role == 'matchmaker':
            err, referred_by = resolve_matchmaker_referral(data.get('referral_code'))
            if err:
                return jsonify({'msg': err}), 400
            self_err = self_matchmaker_referral_error(data.get('referral_code'), email, phone_number)
            if self_err:
                return jsonify({'msg': self_err}), 400

        # Create the user immediately
        user = User(
            email=email,
            phone_number=phone_number,
            role=role,
            first_name=None,
            last_name=None,
            referred_by_id=referred_by)
        user.set_password(password)
        user.email_verified = True  # Auto-verify test emails
        user.phone_verified = True if phone_number else False

        if role == 'user':
            user.referral_code = user.generate_referral_code()
            user.profile_completion_step = 1
        elif role == 'matchmaker':
            user.profile_completion_step = 1

        user.last_active_at = datetime.utcnow()
        db.session.add(user)
        db.session.commit()

        # Create access token (persistent only when remember-me is requested)
        token_expiry = False if remember_me else timedelta(days=1)
        token = create_access_token(identity=str(user.id), expires_delta=token_expiry)
        
        return jsonify({
            'message': 'User created successfully (TEST MODE - auto-verified)',
            'user': user.to_dict(),
            'token': token,
            'test_mode': True,
            'remember_me': remember_me
        }), 200

    if role == 'matchmaker':
        err, _ = resolve_matchmaker_referral(data.get('referral_code'))
        if err:
            return jsonify({'msg': err}), 400
        if email:
            self_err = self_matchmaker_referral_error(data.get('referral_code'), email, phone_number)
            if self_err:
                return jsonify({'msg': self_err}), 400

    # Normal flow: Generate verification token (temporary - not stored in DB)
    verification_token = User.generate_verification_token_static()
    verification_sent = False

    if email:
        verification_sent = send_verification_email(email, verification_token, None)
        if not verification_sent:
            print(f"Warning: Failed to send verification email to {email}")
    else:
        verification_sent = send_verification_sms(phone_number, verification_token, None)
        if not verification_sent:
            print(f"Warning: Failed to send verification SMS to {phone_number}")

    # Return success without creating user
    method = 'email' if email else 'phone'
    return jsonify({
        'message': f'Verification code sent. Please verify your {method}.',
        'verification_sent': verification_sent,
        'verification_method': method,
        'verification_token': verification_token  # Return token for verification
    }), 200

@auth_bp.route('/register-matchmaker-web', methods=['POST'])
def register_matchmaker_web():
    """Create matchmaker account directly from hosted invite signup page"""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    referral_code = (data.get('referral_code') or '').strip()
    has_account = data.get('has_account')

    if not email:
        return jsonify({'msg': 'Email is required'}), 400
    if not is_email(email):
        return jsonify({'msg': 'Please enter a valid email address'}), 400
    if not referral_code:
        return jsonify({'msg': 'Referral code is required'}), 400

    referrer = User.query.filter_by(referral_code=referral_code).first()
    if not referrer or referrer.role != 'user':
        return jsonify({'msg': 'Invalid referral code'}), 400

    self_err = self_matchmaker_referral_error(referral_code, email)
    if self_err:
        return jsonify({'msg': self_err}), 400

    existing_user, existing_matchmaker, existing_dater = resolve_existing_user_for_email(email)
    has_existing = existing_user is not None

    if has_account is True:
        if not has_existing:
            return jsonify({
                'msg': 'No account found with that email. Continue with new account signup.',
                'account_found': False
            }), 404

        if existing_matchmaker:
            dup_err = matchmaker_already_linked_dater_error(existing_matchmaker, referrer)
            if dup_err:
                return jsonify({'msg': dup_err}), 400
            result = link_dater_to_matchmaker(existing_matchmaker, referrer)
            if result.get('error'):
                return jsonify({'msg': result['error']}), 400
            if not result['linked']:
                return jsonify({'msg': 'Maximum of 10 linked daters reached'}), 400
            db.session.commit()
            return jsonify({
                'message': 'Referral code applied to your existing matchmaker account.',
                'action': 'linked_existing_matchmaker',
                'already_linked': result['already_linked'],
                'user_id': existing_matchmaker.id,
                'referrer_first_name': (referrer.first_name or '').strip()
            }), 200

        if existing_dater:
            new_matchmaker = User(
                email=existing_dater.email,
                phone_number=existing_dater.phone_number,
                role='matchmaker',
                first_name=existing_dater.first_name,
                last_name=existing_dater.last_name,
                referred_by_id=referrer.id
            )
            new_matchmaker.password_hash = existing_dater.password_hash
            new_matchmaker.email_verified = existing_dater.email_verified
            new_matchmaker.phone_verified = existing_dater.phone_verified
            # Invite-based web signup should not count as an active session.
            new_matchmaker.last_active_at = None

            db.session.add(new_matchmaker)
            db.session.flush()

            new_matchmaker.linked_account_id = existing_dater.id
            existing_dater.linked_account_id = new_matchmaker.id
            db.session.commit()

            return jsonify({
                'message': 'A new matchmaker account was created from your existing dater account.',
                'action': 'created_matchmaker_from_dater',
                'user_id': new_matchmaker.id,
                'linked_dater_id': existing_dater.id,
                'referrer_first_name': (referrer.first_name or '').strip()
            }), 201

        return jsonify({
            'msg': f"Account exists but role '{existing_user.role}' is not supported for this signup flow."
        }), 400

    if has_existing:
        return jsonify({
            'msg': 'An account with this email already exists. Choose "I already have an account" to continue.',
            'account_found': True
        }), 400

    if not password:
        return jsonify({'msg': 'Please enter a password'}), 400
    is_test_signup = is_test_email(email)
    if not is_test_signup and not is_strong_password(password):
        return jsonify({
            'msg': 'Password must be at least 8 characters and include uppercase, lowercase, and a special character'
        }), 400

    user = User(
        email=email,
        role='matchmaker',
        first_name=None,
        last_name=None,
        referred_by_id=referrer.id
    )
    user.set_password(password)
    user.email_verified = bool(is_test_signup)
    # Invite-based web signup should not count as an active session.
    user.last_active_at = None

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'Account created successfully. Please finish setup in the app.',
        'action': 'created_new_matchmaker',
        'user_id': user.id
    }), 201


@auth_bp.route('/matchmaker-web/check-account', methods=['POST'])
def check_matchmaker_web_account():
    """Check whether an email exists and what account role it has."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    referral_code = (data.get('referral_code') or '').strip()

    if not email:
        return jsonify({'msg': 'Email is required'}), 400
    if not is_email(email):
        return jsonify({'msg': 'Please enter a valid email address'}), 400

    self_err = self_matchmaker_referral_error(referral_code, email)
    if self_err:
        return jsonify({'msg': self_err}), 400

    selected, matchmaker, dater = resolve_existing_user_for_email(email)

    if referral_code and matchmaker:
        ref_user = User.query.filter_by(referral_code=referral_code).first()
        if ref_user and ref_user.role == 'user':
            dup_err = matchmaker_already_linked_dater_error(matchmaker, ref_user)
            if dup_err:
                return jsonify({'msg': dup_err}), 400

    if not selected:
        return jsonify({
            'exists': False,
            'role': None
        }), 200

    if matchmaker:
        role = 'matchmaker'
    elif dater:
        role = 'user'
    else:
        role = selected.role

    return jsonify({
        'exists': True,
        'role': role
    }), 200


def _resolve_dater_invite_matchmaker(invite_token):
    """Return (error_msg, matchmaker_user) or (None, matchmaker)."""
    token = (invite_token or '').strip()
    if not token:
        return 'Invite link is invalid or expired.', None
    matchmaker_id = decode_matchmaker_dater_invite(token)
    if not matchmaker_id:
        return 'Invite link is invalid or expired.', None
    matchmaker = User.query.get(matchmaker_id)
    if not matchmaker or matchmaker.role != 'matchmaker':
        return 'Invite link is invalid or expired.', None
    return None, matchmaker


def _dater_invite_email_is_inviter_own(email, matchmaker):
    mm_email = (matchmaker.email or '').strip().lower()
    return bool(mm_email and email == mm_email)


@auth_bp.route('/dater-web/check-account', methods=['POST'])
def check_dater_web_account():
    """Check whether an email exists for hosted dater invite signup."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    invite_token = data.get('invite_token')

    err, inviter = _resolve_dater_invite_matchmaker(invite_token)
    if err:
        return jsonify({'msg': err}), 400

    if not email:
        return jsonify({'msg': 'Email is required'}), 400
    if not is_email(email):
        return jsonify({'msg': 'Please enter a valid email address'}), 400

    if _dater_invite_email_is_inviter_own(email, inviter):
        return jsonify({'msg': _SELF_MATCHMAKE_MSG}), 400

    selected, matchmaker, dater = resolve_existing_user_for_email(email)
    if not selected:
        return jsonify({'exists': False, 'role': None}), 200

    if dater:
        role = 'user'
    elif matchmaker:
        role = 'matchmaker'
    else:
        role = selected.role

    return jsonify({'exists': True, 'role': role}), 200


@auth_bp.route('/register-dater-web', methods=['POST'])
def register_dater_web():
    """Create or link a dater from the hosted matchmaker invite page."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    invite_token = data.get('invite_token')
    has_account = data.get('has_account')

    err, matchmaker = _resolve_dater_invite_matchmaker(invite_token)
    if err:
        return jsonify({'msg': err}), 400

    if not email:
        return jsonify({'msg': 'Email is required'}), 400
    if not is_email(email):
        return jsonify({'msg': 'Please enter a valid email address'}), 400

    if _dater_invite_email_is_inviter_own(email, matchmaker):
        return jsonify({'msg': _SELF_MATCHMAKE_MSG}), 400

    mm_first = (matchmaker.first_name or '').strip()

    existing_user, existing_matchmaker, existing_dater = resolve_existing_user_for_email(email)
    has_existing = existing_user is not None

    if has_account is True:
        if not has_existing:
            return jsonify({
                'msg': 'No account found with that email. Continue with new account signup.',
                'account_found': False
            }), 404

        if existing_dater:
            result = link_dater_to_matchmaker(matchmaker, existing_dater)
            if result.get('error'):
                return jsonify({'msg': result['error']}), 400
            if not result['linked']:
                return jsonify({'msg': 'Maximum of 10 linked daters reached'}), 400
            db.session.commit()
            return jsonify({
                'message': 'You are now linked to your matchmaker.',
                'action': 'linked_existing_dater',
                'already_linked': result['already_linked'],
                'user_id': existing_dater.id,
                'matchmaker_first_name': mm_first
            }), 200

        if existing_matchmaker:
            return jsonify({
                'msg': 'This email is already a matchmaker account. Use a different email or log in as a dater.'
            }), 400

        return jsonify({
            'msg': f"Account exists but role '{existing_user.role}' is not supported for this signup flow."
        }), 400

    if has_existing:
        return jsonify({
            'msg': 'An account with this email already exists. Choose "I already have an account" to continue.',
            'account_found': True
        }), 400

    if not password:
        return jsonify({'msg': 'Please enter a password'}), 400
    is_test_signup = is_test_email(email)
    if not is_test_signup and not is_strong_password(password):
        return jsonify({
            'msg': 'Password must be at least 8 characters and include uppercase, lowercase, and a special character'
        }), 400

    user = User(
        email=email,
        role='user',
        first_name=None,
        last_name=None,
        referred_by_id=None
    )
    user.set_password(password)
    user.email_verified = bool(is_test_signup)
    user.last_active_at = None
    user.profile_completion_step = 1

    db.session.add(user)
    db.session.flush()

    result = link_dater_to_matchmaker(matchmaker, user)
    if result.get('error'):
        db.session.rollback()
        return jsonify({'msg': result['error']}), 400
    if not result['linked']:
        db.session.rollback()
        return jsonify({'msg': 'Maximum of 10 linked daters reached'}), 400

    db.session.commit()

    return jsonify({
        'message': 'Account created successfully. Please finish setup in the app.',
        'action': 'created_new_dater',
        'user_id': user.id,
        'matchmaker_first_name': mm_first
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    identifier = data.get('email') or data.get('phone_number') or data.get('identifier')
    password = data.get('password')
    remember_me = get_remember_me_flag(data)
    
    if not identifier or not password:
        return jsonify({'error': 'Email/phone number and password are required'}), 400
    
    # Determine if identifier is email or phone
    if is_email(identifier):
        # Login with email
        users = User.query.filter_by(email=identifier).all()
        identifier_type = 'email'
        identifier_value = identifier
    else:
        # Login with phone number (normalize it)
        phone_number = normalize_phone_number(identifier)
        users = User.query.filter_by(phone_number=phone_number).all()
        identifier_type = 'phone number'
        identifier_value = phone_number

    # Check if any users exist with this identifier
    if not users:
        if identifier_type == 'email':
            return jsonify({'error': 'No user with this email exists, please sign up'}), 401
        else:
            return jsonify({'error': 'No user with this phone number exists, please sign up'}), 401

    # Find all users with matching password
    matching_users = []
    for u in users:
        if u.check_password(password):
            matching_users.append(u)

    if not matching_users:
        return jsonify({'error': 'Invalid password'}), 401
    
    # If multiple accounts match, prefer the one that was last active
    # Sort by last_active_at (most recent first), with None values treated as oldest
    matching_users.sort(key=lambda u: u.last_active_at if u.last_active_at else datetime.min, reverse=True)
    user = matching_users[0]
    is_first_active_session = user.last_active_at is None
    
    # Update last_active_at to current time
    user.last_active_at = datetime.utcnow()
    db.session.commit()
    
    # Keep users signed in until they explicitly sign out when remember-me is enabled.
    token_expiry = False if remember_me else timedelta(days=1)
    token = create_access_token(identity=str(user.id), expires_delta=token_expiry)
    response_data = {
        'message': 'Login successful', 
        'user': user.to_dict(),
        'token': token,
        'remember_me': remember_me,
        'is_first_active_session': is_first_active_session
    }
    
    # Add warning if verification is needed (but still allow login)
    if user.email and not user.email_verified:
        response_data['warning'] = 'Please verify your email address'
    elif user.phone_number and not user.phone_verified:
        response_data['warning'] = 'Please verify your phone number'
    
    return jsonify(response_data), 200

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """Verify email or phone using verification token and create user account"""
    data = request.get_json()
    token = data.get('token')
    provided_token = data.get('provided_token')  # The token returned from register
    signup_data = data.get('signup_data')  # The signup data from frontend

    if not token:
        return jsonify({'msg': 'Verification token is required'}), 400

    if not provided_token or not signup_data:
        return jsonify({'msg': 'Signup data and provided token are required'}), 400

    # Verify that the provided token matches (basic security check)
    if token != provided_token:
        return jsonify({'msg': 'Invalid verification token'}), 400

    # Extract signup data
    email = signup_data.get('email')
    phone_number = signup_data.get('phone_number')
    password = signup_data.get('password')
    role = signup_data.get('role', 'user')
    referral_code = signup_data.get('referral_code')

    if not password:
        return jsonify({'msg': 'Password is required'}), 400

    if not email and not phone_number:
        return jsonify({'msg': 'Either email or phone_number is required'}), 400

    # Normalize phone number if provided
    if phone_number:
        phone_number = normalize_phone_number(phone_number)

    # Check for existing user with same email or phone (one more time)
    if email:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'msg': 'Email already registered'}), 400
    else:
        existing_user = User.query.filter_by(phone_number=phone_number).first()
        if existing_user:
            return jsonify({'msg': 'Phone number already registered'}), 400

    referred_by = None
    if role == 'matchmaker':
        err, referred_by = resolve_matchmaker_referral(referral_code)
        if err:
            return jsonify({'msg': err}), 400

    # Create the user now that verification is successful
    user = User(
        email=email,
        phone_number=phone_number,
        role=role,
        first_name=None,
        last_name=None,
        referred_by_id=referred_by)
    user.set_password(password)

    if role == 'user':
        user.referral_code = user.generate_referral_code()
        user.profile_completion_step = 1
    elif role == 'matchmaker':
        user.profile_completion_step = 1

    # Set verification status
    verification_method = 'email' if email else 'phone'
    if verification_method == 'email':
        user.email_verified = True
        user.email_verification_token = None
    else:
        user.phone_verified = True
        user.phone_verification_token = None

    # Set last_active_at for newly created account
    user.last_active_at = datetime.utcnow()

    db.session.add(user)
    db.session.commit()

    # Create access token for verified user
    remember_me = get_remember_me_flag(signup_data)
    token_expiry = False if remember_me else timedelta(days=1)
    access_token = create_access_token(identity=str(user.id), expires_delta=token_expiry)

    method_text = 'Email' if verification_method == 'email' else 'Phone number'
    return jsonify({
        'message': f'{method_text} verified successfully. Account created.',
        'user': user.to_dict(),
        'token': access_token,
        'remember_me': remember_me
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
    """Send password reset email using Resend"""
    try:
        frontend_url = (os.getenv("FRONTEND_URL") or "https://matchmatedating.com").rstrip("/")
        reset_url = f"{frontend_url}/reset-password.html?token={reset_token}"
        
        subject = "Reset Your Password"
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
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""
        
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": subject,
            "html": body_html,
        })
        print(f"Password reset email sent to {email}: {response.get('id')}")
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
        
        frontend_url = (os.getenv("FRONTEND_URL") or "https://matchmatedating.com").rstrip("/")
        reset_url = f"{frontend_url}/reset-password.html?token={reset_token}"
        
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
