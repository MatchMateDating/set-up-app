from app import db
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import JSON

class Match(db.Model):
    __tablename__ = 'match'
    id = db.Column(db.Integer, primary_key=True)
    user_id_1 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user_id_2 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, matched, rejected
    liked_by_id = db.Column(MutableList.as_mutable(JSON), db.ForeignKey('users.id'), nullable=False)  # Who initiated the like
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    matched_by_referrer = db.Column(db.Integer, nullable=True)  # Optional: ID of the matchmaker who facilitated the match


    # relationships to the two users
    user1 = db.relationship('User', foreign_keys=[user_id_1], back_populates='matches_as_user1')
    user2 = db.relationship('User', foreign_keys=[user_id_2], back_populates='matches_as_user2')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id_1': self.user_id_1,
            'user_id_2': self.user_id_2,
            'status': self.status,
            'liked_by_id': self.liked_by_id,
            'matched_by_referrer': self.matched_by_referrer,
        }

