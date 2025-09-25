from app import db


# Association table for match likers
match_likes = db.Table(
    'match_likes',
    db.Column('match_id', db.Integer, db.ForeignKey('match.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)

class Match(db.Model):
    __tablename__ = 'match'
    id = db.Column(db.Integer, primary_key=True)
    user_id_1 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user_id_2 = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, matched, rejected
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    matched_by_matcher = db.Column(db.Integer, nullable=True)  # Optional: ID of the matchmaker who facilitated the match
    blind_match = db.Column(db.Boolean, default=False)  # Indicates if this is a blind match
    note = db.Column(db.Text, nullable=True)


    # relationships to the two users
    user1 = db.relationship('User', foreign_keys=[user_id_1], back_populates='matches_as_user1')
    user2 = db.relationship('User', foreign_keys=[user_id_2], back_populates='matches_as_user2')

    # Relationship: many users can like a match
    liked_by = db.relationship(
        'User',
        secondary=match_likes,
        backref=db.backref('liked_matches', lazy='dynamic')
    )


    def to_dict(self):
        return {
            'id': self.id,
            'user_id_1': self.user_id_1,
            'user_id_2': self.user_id_2,
            'status': self.status,
            'liked_by_ids': [user.id for user in self.liked_by],
            'matched_by_matcher': self.matched_by_matcher,
            'blind_match': self.blind_match,
            'note': self.note 
        }

