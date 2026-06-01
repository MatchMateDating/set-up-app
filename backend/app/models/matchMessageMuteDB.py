from app import db


class MatchMessageMute(db.Model):
    __tablename__ = 'match_message_mute'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'match_id', name='uq_user_match_message_mute'),
    )
