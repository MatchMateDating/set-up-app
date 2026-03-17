from app import db


class ConversationReadState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False, index=True)
    viewer_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    last_read_message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint('conversation_id', 'viewer_user_id', name='uq_conversation_viewer_read_state'),
    )
