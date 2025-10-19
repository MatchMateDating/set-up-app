from app import db, bcrypt
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import JSON

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
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

    referred_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

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

    def __init__(self, email, first_name, last_name, role='user', referred_by_id=None):
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
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
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role,
            "referral_code":self.referral_code,
            "referrer_id": self.referred_by_id,
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
            "avatar": self.avatar
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
                        "referral_code": user.referral_code
                    })
        return {
            "matchmaker_id": self.matchmaker_id,
            "linked_daters": linked_daters
        }

@db.event.listens_for(User, 'after_insert')
def create_referral_row(mapper, connection, target):
    if target.role == 'matchmaker':
        values = {
            "matchmaker_id": target.id,
            "linked_dater_1_id": target.referred_by_id  # set to the referring user's ID
        }
        connection.execute(ReferredUsers.__table__.insert().values(**values))
