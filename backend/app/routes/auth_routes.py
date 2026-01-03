from flask import Blueprint, request, jsonify
from app.models import db, User
from flask_jwt_extended import create_access_token
from flask import current_app

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    print(f"Received data: {data}")
    required_fields = ('first_name', 'last_name', 'email', 'password')

    if not data or not all(k in data for k in required_fields):
        return jsonify({'msg': 'Missing required fields'}), 400

    # Check for existing email - enforce uniqueness for public registration
    # Linked accounts (dater/matchmaker pairs) are created via authenticated profile routes
    existing_user = User.query.filter_by(email=data['email']).first()
    if existing_user:
        return jsonify({'msg': 'Email already registered'}), 400
    
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
        first_name=data['first_name'], 
        last_name=data['last_name'], 
        email=data['email'],
        role=role,
        referred_by_id=referred_by)
    user.set_password(data['password'])

    if role == 'user':
        user.referral_code = user.generate_referral_code()

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))

    return jsonify({
        'message': 'User created successfully', 
        'user': user.to_dict(),
        'token': token}),200

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    # Handle multiple accounts with same email (linked accounts)
    users = User.query.filter_by(email=data['email']).all()
    
    # Find the user with matching password
    user = None
    for u in users:
        if u.check_password(data['password']):
            user = u
            break
    
    if user:
        token = create_access_token(identity=str(user.id))
        return jsonify({
            'message': 'Login successful', 
            'user': user.to_dict(),
            'token': token}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

