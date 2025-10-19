# app/routes/referral_routes.py
from flask import Blueprint, request, jsonify
from app import db
from app.models.userDB import User, ReferredUsers
from flask_jwt_extended import jwt_required, get_jwt_identity

referral_bp = Blueprint('referral', __name__)

@referral_bp.route('/link_referral', methods=['POST'])
@jwt_required()
def link_referral():
    data = request.get_json()
    referral_code = data.get('referral_code')
    current_user_id = get_jwt_identity()

    if not referral_code:
        return jsonify({"error": "Referral code is required"}), 400

    # Find the user with that referral code (the dater)
    dater = User.query.filter_by(referral_code=referral_code).first()
    if not dater or dater.role != "user":
        return jsonify({"error": "Invalid referral code"}), 404

    # Get the matchmaker
    matchmaker = User.query.get(current_user_id)
    if matchmaker.role != "matchmaker":
        return jsonify({"error": "Only matchmakers can link referrals"}), 403

    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        referral_row = ReferredUsers(matchmaker_id=matchmaker.id)
        db.session.add(referral_row)

    # Check if already linked
    for i in range(1, 11):
        existing = getattr(referral_row, f"linked_dater_{i}_id")
        if existing == dater.id:
            return jsonify({"error": "Dater already linked"}), 400

    # Find first empty slot
    for i in range(1, 11):
        col = f"linked_dater_{i}_id"
        if getattr(referral_row, col) is None:
            setattr(referral_row, col, dater.id)
            db.session.commit()
            return jsonify({
                "message": f"Dater {dater.first_name or dater.email} linked to {matchmaker.first_name or matchmaker.email}",
                "linked_dater_id": dater.id
            }), 200

    return jsonify({"error": "Maximum of 10 linked daters reached"}), 400

@referral_bp.route('/referrals/<int:matchmaker_id>', methods=['GET'])
@jwt_required()
def get_referrals(matchmaker_id):
    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker_id).first()
    print('referral row', referral_row)
    if not referral_row:
        return jsonify({"linked_daters": []})
    return jsonify(referral_row.to_dict())
