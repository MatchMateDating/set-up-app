from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User

location_bp = Blueprint('location', __name__)

@location_bp.route('/update', methods=['POST'])
@jwt_required()
def update_location():
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        city = data.get('city')
        state = data.get('state')
        # Debug: log received city/state (remove in prod if verbose)
        if city or state:
            print(f"[Location] user={user_id} city={city!r} state={state!r}")
        match_radius = data.get('match_radius')

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        if latitude is not None and longitude is not None:
            user.latitude = latitude
            user.longitude = longitude

        if city is not None:
            user.city = city
        if state is not None:
            user.state = state

        if match_radius is not None:
            user.match_radius = match_radius

        db.session.commit()
        return jsonify({"message": "Location updated successfully"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
