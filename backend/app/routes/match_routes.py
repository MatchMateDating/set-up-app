from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app.models.matchDB import Match
from app import db
from app.routes.shared import token_required

match_bp = Blueprint('match', __name__)

@match_bp.route('/users_to_match', methods=['GET'])
@token_required
def get_users_to_match(current_user):
    query = User.query.filter(User.role == 'user', User.id != current_user.id)

    # If matchmaker, exclude their referred dater from the list
    if current_user.role == 'matchmaker' and current_user.referrer:
        referred_dater_id = current_user.referrer.id
        
        # Get all user IDs who are already matched with the referred dater
        matched_users = Match.query.filter(
            ((Match.user_id_1 == referred_dater_id) | (Match.user_id_2 == referred_dater_id)) &
            (Match.status == 'matched')
        ).all()

        # Build a set of matched user IDs to exclude
        matched_user_ids = set()
        for match in matched_users:
            if match.user_id_1 != referred_dater_id:
                matched_user_ids.add(match.user_id_1)
            if match.user_id_2 != referred_dater_id:
                matched_user_ids.add(match.user_id_2)

        # Exclude referred dater and already matched users
        query = query.filter(~User.id.in_(matched_user_ids), User.id != referred_dater_id)

    elif current_user.role == 'user':
        # Get all matches involving current user where liked_by_id contains current_user.id
        existing_matches = Match.query.filter(
            Match.liked_by_id.contains([current_user.id]),
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id))
        ).all()

        matched_user_ids = set()
        for match in existing_matches:
            if match.user_id_1 != current_user.id:
                matched_user_ids.add(match.user_id_1)
            if match.user_id_2 != current_user.id:
                matched_user_ids.add(match.user_id_2)

        # Exclude users already matched by the matchmaker
        query = query.filter(~User.id.in_(matched_user_ids))

    users = query.all()
    return jsonify([user.to_dict() for user in users])

@match_bp.route('/blind_match', methods=['POST'])
@token_required
def blind_match(current_user):
    if current_user.role != 'matchmaker':
        return jsonify({'message': 'Only matchmakers can perform blind matches'}), 403

    data = request.get_json()
    liked_user_id = data.get('liked_user_id')

    if not liked_user_id:
        return jsonify({'message': 'liked_user_id is required'}), 400

    referred_dater_id = current_user.referrer.id

    existing_match = Match.query.filter(
        ((Match.user_id_1 == referred_dater_id) & (Match.user_id_2 == liked_user_id)) |
        ((Match.user_id_1 == liked_user_id) & (Match.user_id_2 == referred_dater_id))
    ).first()

    if existing_match:
        existing_match.status = 'matched'
        existing_match.matched_by_matcher = current_user.id
        existing_match.blind_match = True
    else:
        new_match = Match(
            user_id_1=referred_dater_id,
            user_id_2=liked_user_id,
            liked_by_id=[referred_dater_id, liked_user_id],
            matched_by_matcher=current_user.id,
            status='matched',
            blind_match=True
        )
        db.session.add(new_match)

    db.session.commit()
    return jsonify({'message': 'Blind match created successfully'}), 201


@match_bp.route('/like', methods=['POST'])
@token_required
def like_user(current_user):
    data = request.get_json()
    liked_user_id = data.get('liked_user_id')
    print(f"User {current_user.id} is trying to like User {liked_user_id}")

    if not liked_user_id:
        return jsonify({'message': 'liked_user_id is required'}), 400
    
    existing_match = Match.query.filter(
        ((Match.user_id_1 == current_user.id) & (Match.user_id_2 == liked_user_id)) |
        ((Match.user_id_1 == liked_user_id) & (Match.user_id_2 == current_user.id))
    ).first()
    
    if existing_match:
        # Add current user to liked_by_id if not already in list
        if current_user.id not in existing_match.liked_by_id:
            existing_match.liked_by_id.append(current_user.id)
            print(f"Added User {current_user.id} to liked_by_id list")
        print(f"new id add f{existing_match.liked_by_id}")

        # If both users have liked, mark as matched
        if current_user.id in existing_match.liked_by_id and liked_user_id in existing_match.liked_by_id:
            existing_match.status = 'matched'
            print(f"Match between User {current_user.id} and User {liked_user_id} is now mutual!")

        db.session.add(existing_match)
        db.session.commit()
        return jsonify({'message': 'Like processed', 'match': existing_match.to_dict()}), 200

    new_match = Match(
        user_id_1=current_user.id if current_user.role == 'user' else current_user.referrer.id,
        user_id_2=liked_user_id,
        liked_by_id=[current_user.id] if current_user.role == 'user' else [current_user.referrer.id],
        matched_by_matcher= current_user.id if current_user.role == 'matchmaker' else None,
        status='pending')
    
    db.session.add(new_match)   
    db.session.commit()

    print(f"New pending like created: {new_match.to_dict()}")
    return jsonify(new_match.to_dict()), 201

@match_bp.route('/matches', methods=['GET'])
@token_required
def get_mutual_matches(current_user):
    print(f"Fetching matches for User {current_user.id} or type {current_user.role}")
    matched_users = []
    if current_user.role == 'matchmaker':
        linked_dater = current_user.referrer
        print(f"linked_dater: {linked_dater.id} for matchmaker {current_user.id}")
        matches = Match.query.filter(
            ((Match.user_id_1 == linked_dater.id) | (Match.user_id_2 == linked_dater.id)) &
            (Match.status == 'matched') &
            (Match.matched_by_matcher == current_user.id)).all()

        for match in matches:
            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = match.user1 if match.user2.id == current_user.id else match.user2
            user_dict = other_user.to_dict()
            linked_dater_dict = linked_dater.to_dict()
            user_dict['first_image'] = other_user.images[0].image_url if other_user.images else None
            linked_dater_dict['first_image'] = linked_dater.images[0].image_url if linked_dater.images else None
            matched_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': linked_dater_dict,
                'blind_match': match.blind_match
            })

        return jsonify(matched_users)
    elif current_user.role == 'user':
        matches = Match.query.filter(
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id)) &
            (Match.status == 'matched')
        ).all()

        for match in matches:
            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = user1 if user2.id == current_user.id else user2

            user_dict = other_user.to_dict()
            user_dict['first_image'] = other_user.images[0].image_url if other_user.images else None
            if match.matched_by_matcher:
                # Match was made by a matchmaker -> fetch linked_dater info
                linked_dater = User.query.get(match.user_id_1 if match.user_id_1 != current_user.id else match.user_id_2)
                linked_dater_dict = linked_dater.to_dict()
                linked_dater_dict['first_image'] = linked_dater.images[0].image_url if linked_dater.images else None
                matched_users.append({
                    'match_id': match.id,
                    'match_user': user_dict,
                    'linked_dater': linked_dater_dict,
                    'blind_match': match.blind_match
                })
            else:
                # Match was made by the user directly
                matched_users.append({
                    'match_id': match.id,
                    'match_user': user_dict,
                    'linked_dater': None,
                    'blind_match': match.blind_match
                })

    return jsonify(matched_users)

@match_bp.route('/unmatch/<int:match_id>', methods=['DELETE'])
@token_required
def unmatch(current_user, match_id):
    match = Match.query.get(match_id)

    if not match:
        return jsonify({'message': 'Match not found'}), 404

    # Only allow unmatching if current user is part of the match
    if current_user.id not in [match.user_id_1, match.user_id_2]:
        return jsonify({'message': 'Unauthorized'}), 403

    db.session.delete(match)
    db.session.commit()

    return jsonify({'message': 'Unmatched successfully'}), 200


