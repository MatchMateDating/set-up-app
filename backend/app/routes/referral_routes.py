# app/routes/referral_routes.py
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from app import db
from app.models.userDB import User, ReferredUsers
from app.dater_invite_tokens import encode_matchmaker_dater_invite
from app.routes.auth_routes import matchmaker_cannot_link_dater_error, link_dater_to_matchmaker
from app.services.referral_notification_service import notify_dater_matchmaker_referral_link
from flask_jwt_extended import jwt_required, get_jwt_identity

referral_bp = Blueprint('referral', __name__)


def _user_id_from_jwt(identity):
    if identity is None:
        return None
    return int(identity)


@referral_bp.route('/dater_invite_token', methods=['POST'])
@jwt_required()
def create_dater_invite_token():
    """Return a signed token for building the hosted dater signup URL."""
    current_user_id = get_jwt_identity()
    matchmaker = User.query.get(current_user_id)
    if not matchmaker or matchmaker.role != 'matchmaker':
        return jsonify({'error': 'Only matchmakers can create dater invite links'}), 403
    token = encode_matchmaker_dater_invite(matchmaker.id)
    return jsonify({'invite_token': token}), 200

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

    link_err = matchmaker_cannot_link_dater_error(matchmaker, dater)
    if link_err:
        return jsonify({"error": link_err}), 400

    result = link_dater_to_matchmaker(matchmaker, dater)
    if result.get("error"):
        return jsonify({"error": result["error"]}), 400
    if result.get("already_linked"):
        return jsonify({"error": "Dater already linked"}), 400
    if not result.get("linked"):
        return jsonify({"error": "Maximum of 10 linked daters reached"}), 400

    if matchmaker.referred_by_id is None:
        matchmaker.referred_by_id = dater.id
    db.session.commit()
    notify_dater_matchmaker_referral_link(matchmaker, dater)

    return jsonify({
        "message": f"Dater {dater.first_name or dater.email} linked to {matchmaker.first_name or matchmaker.email}",
        "linked_dater_id": dater.id,
        "selected_dater_id": matchmaker.referred_by_id,
    }), 200

@referral_bp.route('/referrals/<int:matchmaker_id>', methods=['GET'])
@jwt_required()
def get_referrals(matchmaker_id):
    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker_id).first()
    print('referral row', referral_row)
    if not referral_row:
        return jsonify({"linked_daters": []})
    return jsonify(referral_row.to_dict())

@referral_bp.route('/set_selected_dater', methods=['POST'])
@jwt_required()
def set_selected_dater():
    data = request.get_json()
    selected_dater_id = data.get('selected_dater_id')
    current_user_id = get_jwt_identity()

    if not selected_dater_id:
        return jsonify({"error": "selected_dater_id required"}), 400

    matchmaker = User.query.get(current_user_id)
    if not matchmaker or matchmaker.role != "matchmaker":
        return jsonify({"error": "Only matchmakers can set a selected dater"}), 403

    # Validate that the selected dater is actually one of their linked daters
    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        return jsonify({"error": "No linked daters found"}), 404

    linked_ids = [
        getattr(referral_row, f"linked_dater_{i}_id")
        for i in range(1, 11)
        if getattr(referral_row, f"linked_dater_{i}_id") is not None
    ]
    if int(selected_dater_id) not in linked_ids:
        return jsonify({"error": "Selected dater not linked to this matchmaker"}), 403

    matchmaker.referred_by_id = selected_dater_id
    db.session.commit()

    return jsonify({"message": f"Selected dater set to {selected_dater_id}"}), 200


@referral_bp.route('/unlink_dater', methods=['POST'])
@jwt_required()
def unlink_dater():
    data = request.get_json() or {}
    linked_dater_id = data.get('linked_dater_id')
    current_user_id = get_jwt_identity()

    if not linked_dater_id:
        return jsonify({"error": "linked_dater_id is required"}), 400

    matchmaker = User.query.get(current_user_id)
    if not matchmaker or matchmaker.role != "matchmaker":
        return jsonify({"error": "Only matchmakers can unlink daters"}), 403

    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        return jsonify({"error": "No linked daters found"}), 404

    linked_dater_id = int(linked_dater_id)
    removed = False
    for i in range(1, 11):
        col = f"linked_dater_{i}_id"
        if getattr(referral_row, col) == linked_dater_id:
            setattr(referral_row, col, None)
            removed = True
            break

    if not removed:
        return jsonify({"error": "Dater not linked to this matchmaker"}), 404

    # Keep selected dater consistent after removal.
    remaining_ids = [
        getattr(referral_row, f"linked_dater_{i}_id")
        for i in range(1, 11)
        if getattr(referral_row, f"linked_dater_{i}_id") is not None
    ]
    if matchmaker.referred_by_id == linked_dater_id:
        matchmaker.referred_by_id = remaining_ids[0] if remaining_ids else None

    db.session.commit()
    return jsonify({
        "message": "Linked dater removed successfully",
        "linked_daters": referral_row.to_dict().get("linked_daters", []),
        "selected_dater_id": matchmaker.referred_by_id
    }), 200


def _matchmaker_summary_dict(mm_user):
    if not mm_user:
        return None
    name = f"{mm_user.first_name or ''}".strip()
    first_image = mm_user.images[0].image_url if mm_user.images else None
    return {
        "id": mm_user.id,
        "name": name or "Matchmaker",
        "first_image": first_image,
    }


@referral_bp.route('/linked_matchmakers', methods=['GET'])
@jwt_required()
def get_linked_matchmakers_for_dater():
    """All matchmakers who have this dater in their linked roster (used the dater's referral code or linked flow)."""
    dater_id = _user_id_from_jwt(get_jwt_identity())
    dater = User.query.get(dater_id)
    if not dater or dater.role != 'user':
        return jsonify({"error": "Only daters can view linked matchmakers"}), 403

    slot_filters = [
        getattr(ReferredUsers, f"linked_dater_{i}_id") == dater.id
        for i in range(1, 11)
    ]
    rows = ReferredUsers.query.filter(or_(*slot_filters)).all()
    linked = []
    seen_mm = set()
    for row in rows:
        if row.matchmaker_id in seen_mm:
            continue
        mm = User.query.get(row.matchmaker_id)
        if not mm or mm.role != 'matchmaker':
            continue
        seen_mm.add(row.matchmaker_id)
        summary = _matchmaker_summary_dict(mm)
        if summary:
            linked.append(summary)

    return jsonify({"linked_matchmakers": linked}), 200


@referral_bp.route('/dater_unlink_matchmaker', methods=['POST'])
@jwt_required()
def dater_unlink_matchmaker():
    """Dater removes a matchmaker from their roster so that matchmaker can no longer matchmake for them."""
    data = request.get_json() or {}
    matchmaker_id = data.get('matchmaker_id')
    dater_id = _user_id_from_jwt(get_jwt_identity())

    if matchmaker_id is None:
        return jsonify({"error": "matchmaker_id is required"}), 400

    dater = User.query.get(dater_id)
    if not dater or dater.role != 'user':
        return jsonify({"error": "Only daters can remove a linked matchmaker"}), 403

    try:
        matchmaker_id = int(matchmaker_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid matchmaker_id"}), 400

    matchmaker = User.query.get(matchmaker_id)
    if not matchmaker or matchmaker.role != 'matchmaker':
        return jsonify({"error": "Matchmaker not found"}), 404

    referral_row = ReferredUsers.query.filter_by(matchmaker_id=matchmaker.id).first()
    if not referral_row:
        return jsonify({"error": "No linked roster for this matchmaker"}), 404

    removed = False
    for i in range(1, 11):
        col = f"linked_dater_{i}_id"
        if getattr(referral_row, col) == dater.id:
            setattr(referral_row, col, None)
            removed = True
            break

    if not removed:
        return jsonify({"error": "This matchmaker is not linked to you"}), 404

    remaining_ids = [
        getattr(referral_row, f"linked_dater_{i}_id")
        for i in range(1, 11)
        if getattr(referral_row, f"linked_dater_{i}_id") is not None
    ]
    if matchmaker.referred_by_id == dater.id:
        matchmaker.referred_by_id = remaining_ids[0] if remaining_ids else None

    db.session.commit()

    slot_filters = [
        getattr(ReferredUsers, f"linked_dater_{i}_id") == dater.id
        for i in range(1, 11)
    ]
    rows = ReferredUsers.query.filter(or_(*slot_filters)).all()
    linked = []
    seen_mm = set()
    for row in rows:
        if row.matchmaker_id in seen_mm:
            continue
        mm = User.query.get(row.matchmaker_id)
        if not mm or mm.role != 'matchmaker':
            continue
        seen_mm.add(row.matchmaker_id)
        summary = _matchmaker_summary_dict(mm)
        if summary:
            linked.append(summary)

    return jsonify({
        "message": "Matchmaker removed successfully",
        "linked_matchmakers": linked,
        "selected_dater_id": matchmaker.referred_by_id,
    }), 200

