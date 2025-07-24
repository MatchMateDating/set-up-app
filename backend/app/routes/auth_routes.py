from flask import Blueprint, request, jsonify
from app.models import db, User
from flask_jwt_extended import create_access_token
from flask import current_app

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    required_fields = ('name', 'email', 'password')

    if not data or not all(k in data for k in required_fields):
        return jsonify({'msg': 'Missing required fields'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'msg': 'Email already registered'}), 400
    
    role = data.get('role', 'user')  # default is normal user
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
        name=data['name'], 
        email=data['email'],
        role=role,
        referred_by_id=referred_by)
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))

    return jsonify({
        'message': 'User created successfully', 
        'user': user.to_dict(),
        'token': token}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()

    if user and user.check_password(data['password']):
        token = create_access_token(identity=str(user.id))
        return jsonify({
            'message': 'Login successful', 
            'user': user.to_dict(),
            'token': token}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

