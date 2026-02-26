from app import db, bcrypt
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import secrets
import secrets
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import JSON
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=True)  # nullable to allow phone-only accounts
    phone_number = db.Column(db.String(20), nullable=True)  # E.164 format: +1234567890
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(120), nullable=True)
    last_name = db.Column(db.String(120), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='user') 
    referral_code = db.Column(db.String(10), unique=True, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    birthdate = db.Column(db.Date, nullable=True)
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    height = db.Column(db.String(10), nullable=True)
    fontFamily = db.Column(db.String(50), nullable=True, default='Arial')
    profileStyle = db.Column(db.String(20), nullable=True, default='classic')
    imageLayout = db.Column(db.String(20), nullable=True, default='grid')
    avatar = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    city = db.Column(db.String(120), nullable=True)
    state = db.Column(db.String(60), nullable=True)
    show_location = db.Column(db.Boolean, nullable=False, default=False)
    match_radius = db.Column(db.Integer, nullable=True, default=0)  # in miles; used with haversine_distance
    unit = db.Column(db.String(20), nullable=False, default='Imperial')
    last_active_at = db.Column(db.DateTime, nullable=True)
    push_token = db.Column(db.String(255), nullable=True)  # Expo push notification token
    notifications_enabled = db.Column(db.Boolean, nullable=False, default=False)  # User's notification preference
    email_verified = db.Column(db.Boolean, nullable=False, default=False)
    email_verification_token = db.Column(db.String(100), nullable=True, unique=True)
    phone_verified = db.Column(db.Boolean, nullable=False, default=False)
    phone_verification_token = db.Column(db.String(100), nullable=True, unique=True)
    password_reset_token = db.Column(db.String(100), nullable=True, unique=True)
    password_reset_token_expires = db.Column(db.DateTime, nullable=True)
    profile_completion_step = db.Column(db.Integer, nullable=True)  # 1, 2, or 3 if incomplete, None if complete

    referred_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_account_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def get_linked_daters(self):
        if self.role != "matchmaker":
            return []
        referral_row = ReferredUsers.query.filter_by(matchmaker_id=self.id).first()
        if not referral_row:
            return []
        ids = [
            getattr(referral_row, f"linked_dater_{i}_id")
            for i in range(1, 11)
            if getattr(referral_row, f"linked_dater_{i}_id") is not None
        ]
        return User.query.filter(User.id.in_(ids)).all() if ids else []


    preferredAgeMin = db.Column(db.Integer, nullable=True)
    preferredAgeMax = db.Column(db.Integer, nullable=True)
    preferredGenders = db.Column(MutableList.as_mutable(JSON), nullable=True)

    images = db.relationship('Image', backref='user', lazy=True, cascade='all, delete-orphan')
    # Clarify both sides of the Match relationships
    matches_as_user1 = db.relationship('Match', foreign_keys='Match.user_id_1', back_populates='user1')
    matches_as_user2 = db.relationship('Match', foreign_keys='Match.user_id_2', back_populates='user2')
    push_tokens = db.relationship('PushToken', backref='user', lazy=True, cascade='all, delete-orphan')

    def __init__(self, email=None, phone_number=None, role='user', first_name=None, last_name=None, referred_by_id=None):
        self.email = email
        self.phone_number = phone_number
        self.phone_number = phone_number
        self.first_name = first_name
        self.last_name = last_name
        self.role = role
        self.referred_by_id = referred_by_id
        if role == 'user':
            self.referral_code = self.generate_referral_code()

    def generate_referral_code(self):
        return str(uuid.uuid4())[:10]
    
    def generate_verification_token(self):
        """Generate a 4-digit verification code"""
        return f"{secrets.randbelow(10000):04d}"

    @staticmethod
    def generate_verification_token_static():
        """Generate a 4-digit verification code (static method)"""
        return f"{secrets.randbelow(10000):04d}"
    
    def generate_password_reset_token(self):
        """Generate a secure password reset token"""
        return secrets.token_urlsafe(32)
    
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def get_linked_account(self):
        """Get the linked account (matchmaker or dater)"""
        if self.linked_account_id:
            return User.query.get(self.linked_account_id)
        return None

    def to_dict(self):
        linked_account = self.get_linked_account()
        linked_account_info = None
        if linked_account:
            # Include only basic info to avoid infinite recursion
            linked_account_info = {
                "id": linked_account.id,
                "role": linked_account.role,
                "first_name": linked_account.first_name,
                "last_name": linked_account.last_name
            }
        
        return {
            "id": self.id,
            "email": self.email,
            "phone_number": self.phone_number,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role,
            "referral_code":self.referral_code,
            "referrer_id": self.referred_by_id,
            "linked_account_id": self.linked_account_id,
            "linked_account": linked_account_info,
            "linked_daters": [d.id for d in self.get_linked_daters()],
            "bio": self.bio,
            "age": self.age,
            "birthdate": self.birthdate.isoformat() if self.birthdate else None,
            "gender": self.gender,
            "height": self.height,
            "fontFamily": self.fontFamily,
            "profileStyle": self.profileStyle,
            "imageLayout": self.imageLayout,
            "images": [image.to_dict() for image in self.images],
            "preferredAgeMin": self.preferredAgeMin,
            "preferredAgeMax": self.preferredAgeMax,
            "preferredGenders": self.preferredGenders,
            "avatar": self.avatar,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "city": self.city,
            "state": self.state,
            "show_location": self.show_location,
            "match_radius": self.match_radius,
            "unit": self.unit,
            "notifications_enabled": self.notifications_enabled,
            "email_verified": self.email_verified,
            "phone_verified": self.phone_verified,
            "profile_completion_step": self.profile_completion_step,
        }

class ReferredUsers(db.Model):
    __tablename__ = 'referred_users'

    matchmaker_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    linked_dater_1_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_2_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_3_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_4_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_5_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_6_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_7_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_8_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_9_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    linked_dater_10_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    matchmaker = db.relationship(
        'User', 
        foreign_keys=[matchmaker_id], 
        backref=db.backref('referral_links', uselist=False))

    def to_dict(self):
        linked_daters = []
        for i in range(1, 11):
            dater_id = getattr(self, f"linked_dater_{i}_id")
            if dater_id:
                user = User.query.get(dater_id)
                if user:
                    linked_daters.append({
                        "id": user.id,
                        "name": f"{user.first_name or ''}".strip(),
                        "referral_code": user.referral_code,
                        "first_image": user.images[0].image_url if user.images else None,
                        "unit": user.unit,
                    })
        return {
            "matchmaker_id": self.matchmaker_id,
            "linked_daters": linked_daters,
        }

class PushToken(db.Model):
    __tablename__ = 'push_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def __init__(self, user_id, token):
        self.user_id = user_id
        self.token = token
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@db.event.listens_for(User, 'after_insert')
def create_referral_row(mapper, connection, target):
    if target.role == 'matchmaker':
        values = {
            "matchmaker_id": target.id,
            "linked_dater_1_id": target.referred_by_id  # set to the referring user's ID
        }
        connection.execute(ReferredUsers.__table__.insert().values(**values))
