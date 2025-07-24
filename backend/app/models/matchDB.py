from app import db

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id_1 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user_id_2 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    # relationships to the two users
    user1 = db.relationship('User', foreign_keys=[user_id_1], back_populates='matches_as_user1')
    user2 = db.relationship('User', foreign_keys=[user_id_2], back_populates='matches_as_user2')


