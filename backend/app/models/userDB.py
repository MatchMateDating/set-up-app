from app import db, bcrypt
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(120), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='user') 
    referral_code = db.Column(db.String(10), unique=True, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    height = db.Column(db.String(10), nullable=True)
    description = db.Column(db.Text, nullable=True)


    referred_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    referred_users = db.relationship('User', backref=db.backref('referrer', remote_side=[id]), lazy=True)

    images = db.relationship('Image', backref='user', lazy=True, cascade='all, delete-orphan')
    # Clarify both sides of the Match relationships
    matches_as_user1 = db.relationship('Match', foreign_keys='Match.user_id_1', back_populates='user1')
    matches_as_user2 = db.relationship('Match', foreign_keys='Match.user_id_2', back_populates='user2')

    def __init__(self, email, name, role='user', referred_by_id=None):
        self.email = email
        self.name = name
        self.role = role
        self.referred_by_id = referred_by_id
        if role == 'user':
            self.referral_code = self.generate_referral_code()

    def generate_referral_code(self):
        return str(uuid.uuid4())[:10]

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "referral_code":self.referral_code,
            "referrer_id": self.referred_by_id,
            "bio": self.bio,
            "age": self.age,
            "gender": self.gender,
            "height": self.height,
            "description": self.description,
            "images": [image.to_dict() for image in self.images]
        }
