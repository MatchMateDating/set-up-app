from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
import httpx

location_bp = Blueprint('location', __name__)


def _reverse_geocode(latitude, longitude):
    """Fallback: derive city/state from lat/long via Nominatim when mobile didn't send them."""
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": latitude, "lon": longitude, "format": "json", "addressdetails": 1},
                headers={"User-Agent": "MatchmateDating/1.0"},
            )
            if r.status_code != 200:
                return None, None
            data = r.json()
            addr = data.get("address") or {}
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
            state = addr.get("state")
            return city, state
    except Exception:
        return None, None


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
        match_radius = data.get('match_radius')

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        if latitude is not None and longitude is not None:
            user.latitude = latitude
            user.longitude = longitude
            # If mobile didn't send city/state, derive from coordinates
            if (city is None or state is None) and latitude is not None and longitude is not None:
                derived_city, derived_state = _reverse_geocode(latitude, longitude)
                if city is None and derived_city:
                    city = derived_city
                if state is None and derived_state:
                    state = derived_state

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
