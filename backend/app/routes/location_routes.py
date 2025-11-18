from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User

location_bp = Blueprint('location', __name__)

@location_bp.route('/update', methods=['POST'])
@jwt_required()
def update_location():
    print("Received location update request")
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        match_radius = data.get('match_radius')

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        if latitude is not None and longitude is not None:
            user.latitude = latitude
            user.longitude = longitude

        if match_radius is not None:
            user.match_radius = match_radius

        db.session.commit()
        return jsonify({"message": "Location updated successfully"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
