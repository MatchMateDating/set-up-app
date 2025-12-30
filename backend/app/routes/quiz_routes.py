from flask import Blueprint, jsonify, request
from app import db
from app.models.quizDB import QuizResult
from app.routes.shared import token_required

quiz_bp = Blueprint("quiz", __name__)

# Save quiz result
@quiz_bp.route("/result", methods=["POST"])
@token_required
def save_quiz_result(current_user):
    data = request.get_json()

    quiz_name = data.get("quiz_name")
    quiz_version = data.get("quiz_version")
    result = data.get("result")
    answers = data.get("answers")

    if not quiz_name or not result:
        return jsonify({"message": "quiz_name and result are required"}), 400

    quiz_result = QuizResult(
        user_id=current_user.id,
        quiz_name=quiz_name,
        quiz_version=quiz_version,
        result=result,
        answers=answers,
    )
    db.session.add(quiz_result)
    db.session.commit()

    return jsonify(quiz_result.to_dict()), 201


# Get all quiz results for current user
@quiz_bp.route("/results", methods=["GET"])
@token_required
def get_quiz_results(current_user):
    results = QuizResult.query.filter_by(user_id=current_user.id).all()
    return jsonify([r.to_dict() for r in results]), 200


# Get quiz results by quiz name (optional filter)
@quiz_bp.route("/results/<string:quiz_name>", methods=["GET"])
@token_required
def get_quiz_results_by_name(current_user, quiz_name):
    results = QuizResult.query.filter_by(user_id=current_user.id, quiz_name=quiz_name).all()
    return jsonify([r.to_dict() for r in results]), 200


# Delete a quiz result (if user wants to reset/retry)
@quiz_bp.route("/result/<int:result_id>", methods=["DELETE"])
@token_required
def delete_quiz_result(current_user, result_id):
    quiz_result = QuizResult.query.filter_by(id=result_id, user_id=current_user.id).first()
    if not quiz_result:
        return jsonify({"message": "Result not found or unauthorized"}), 404

    db.session.delete(quiz_result)
    db.session.commit()

    return jsonify({"message": "Quiz result deleted successfully"}), 200
