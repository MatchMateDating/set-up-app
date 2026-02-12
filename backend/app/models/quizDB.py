from datetime import datetime
from app import db

class QuizResult(db.Model):
    __tablename__ = "quiz_results"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Identify which quiz this result belongs to
    quiz_name = db.Column(db.String(100), nullable=False)  # e.g. "Personality Quiz", "Love Language"
    quiz_version = db.Column(db.String(20), nullable=True)  # optional, track version of quiz

    # Result of the quiz (final outcome)
    result = db.Column(db.Text, nullable=False)

    # Store full set of answers if needed
    answers = db.Column(db.JSON, nullable=True)

    # When the quiz was taken
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("quiz_results", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "quiz_name": self.quiz_name,
            "quiz_version": self.quiz_version,
            "result": self.result,
            "answers": self.answers,
            "created_at": self.created_at.isoformat(),
        }
