from .. import db, bcrypt
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(120), nullable=True)
    # images = db.Column(db.JSON, nullable=True)
    images = db.relationship('Image', backref='user', lazy=True, cascade='all, delete-orphan')
    # Clarify both sides of the Match relationships
    matches_as_user1 = db.relationship('Match', foreign_keys='Match.user_id_1', back_populates='user1')
    matches_as_user2 = db.relationship('Match', foreign_keys='Match.user_id_2', back_populates='user2')

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "images": [image.to_dict() for image in self.images]
        }
