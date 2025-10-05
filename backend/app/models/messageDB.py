from app import db

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, server_default=db.func.now())
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    puzzle_type = db.Column(db.String(50), nullable=True)
    puzzle_link = db.Column(db.String(50), nullable=True)
