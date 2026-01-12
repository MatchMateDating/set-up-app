from app import db
from datetime import datetime

class UserBlock(db.Model):
    __tablename__ = 'user_blocks'
    
    id = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    # Ensure a user can only block another user once
    __table_args__ = (db.UniqueConstraint('blocker_id', 'blocked_id', name='unique_user_block'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'blocker_id': self.blocker_id,
            'blocked_id': self.blocked_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
