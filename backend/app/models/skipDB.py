from app import db
from datetime import datetime

class UserSkip(db.Model):
    __tablename__ = 'user_skips'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    skipped_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    # Ensure a user can only skip another user once
    __table_args__ = (db.UniqueConstraint('user_id', 'skipped_user_id', name='unique_user_skip'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'skipped_user_id': self.skipped_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
