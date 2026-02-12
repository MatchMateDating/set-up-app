from app import db

class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    messages = db.relationship('Message', backref='conversation', lazy=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
