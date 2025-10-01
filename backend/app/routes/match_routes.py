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

    # Add preferences filtering
    if current_user.preferredAgeMin and current_user.preferredAgeMax:
        query = query.filter(User.age.between(
            current_user.preferredAgeMin, 
            current_user.preferredAgeMax
        ))

    if current_user.preferredGenders:
        query = query.filter(User.gender.in_(current_user.preferredGenders))

    # If matchmaker, exclude their referred dater from the list
    if current_user.role == 'matchmaker' and current_user.referrer:
        referred_dater_id = current_user.referrer.id

        liked_by_linked_dater = Match.query.filter(
            (Match.user_id_1 == referred_dater_id) | (Match.user_id_2 == referred_dater_id)
        ).all()

        liked_user_ids = set()
        for match in liked_by_linked_dater:
            if any(u.id == referred_dater_id for u in match.liked_by):
                if match.user_id_1 != referred_dater_id:
                    liked_user_ids.add(match.user_id_1)
                if match.user_id_2 != referred_dater_id:
                    liked_user_ids.add(match.user_id_2)

        matched_users = Match.query.filter(
            ((Match.user_id_1 == referred_dater_id) | (Match.user_id_2 == referred_dater_id)) &
            (Match.status == 'matched')
        ).all()

        matched_user_ids = set()
        for match in matched_users:
            if match.user_id_1 != referred_dater_id:
                matched_user_ids.add(match.user_id_1)
            if match.user_id_2 != referred_dater_id:
                matched_user_ids.add(match.user_id_2)

        query = query.filter(
            ~User.id.in_(matched_user_ids),
            ~User.id.in_(liked_user_ids),
            User.id != referred_dater_id)

    elif current_user.role == 'user':
        existing_matches = Match.query.filter(
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id)) &
            (Match.status == 'matched')
        ).all()

        matched_user_ids = set()
        for match in existing_matches:
            if match.user_id_1 != current_user.id:
                matched_user_ids.add(match.user_id_1)
            if match.user_id_2 != current_user.id:
                matched_user_ids.add(match.user_id_2)

        query = query.filter(~User.id.in_(matched_user_ids))

        pending_likes = Match.query.filter(
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id)) &
            (Match.status == 'pending')
        ).all()

        pending_user_ids = set()
        for match in pending_likes:
            if any(u.id == current_user.id for u in match.liked_by):
                if match.user_id_1 != current_user.id:
                    pending_user_ids.add(match.user_id_1)
                if match.user_id_2 != current_user.id:
                    pending_user_ids.add(match.user_id_2)

        query = query.filter(~User.id.in_(pending_user_ids))

    users = query.all()
    users_data = []
    for user in users:
        if current_user.preferredAgeMin and current_user.preferredAgeMax and user.preferredAgeMin and user.preferredAgeMax:
            if not (user.preferredAgeMin <= current_user.age <= user.preferredAgeMax):
                continue
        if current_user.preferredGenders and user.preferredGenders:
            if current_user.gender not in user.preferredGenders:
                continue
        liked_linked_dater = False
        note_text = None
        matched_by_matcher = None
        match = Match.query.filter(
            ((Match.user_id_1 == current_user.id) & (Match.user_id_2 == user.id)) |
            ((Match.user_id_1 == user.id) & (Match.user_id_2 == current_user.id))
        ).first()

        if match:
            if match.note:
                note_text = match.note
            if match.matched_by_matcher:
                matched_by_matcher = match.matched_by_matcher

        if current_user.role == 'matchmaker' and current_user.referrer:
            referred_dater_id = current_user.referrer.id
            match = Match.query.filter(
                ((Match.user_id_1 == user.id) & (Match.user_id_2 == referred_dater_id)) |
                ((Match.user_id_1 == referred_dater_id) & (Match.user_id_2 == user.id))
            ).first()
            if match and any(u.id == referred_dater_id for u in match.liked_by) and not any(u.id == user.id for u in match.liked_by):
                liked_linked_dater = True

        user_dict = user.to_dict()
        user_dict['liked_linked_dater'] = liked_linked_dater
        user_dict['note'] = note_text
        user_dict['matched_by_matcher'] = matched_by_matcher
        users_data.append(user_dict)
    return jsonify(users_data)

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
            liked_by_ids=[referred_dater_id, liked_user_id],
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
    
    liked_user = User.query.get(liked_user_id)
    if not liked_user:
        return jsonify({'message': 'User not found'}), 404

    existing_match = Match.query.filter(
        ((Match.user_id_1 == current_user.id) & (Match.user_id_2 == liked_user_id)) |
        ((Match.user_id_1 == liked_user_id) & (Match.user_id_2 == current_user.id))
    ).first()
    
    if existing_match:
        if current_user not in existing_match.liked_by:
            existing_match.liked_by.append(current_user)
            print(f"Added User {current_user.id} to liked_by list")

        if (current_user in existing_match.liked_by and 
            liked_user in existing_match.liked_by):
            existing_match.status = 'matched'
            print(f"Match between User {current_user.id} and User {liked_user_id} is now mutual!")

        db.session.add(existing_match)
        db.session.commit()
        return jsonify({'message': 'Like processed', 'match': existing_match.to_dict()}), 200

    new_match = Match(
        user_id_1=current_user.id if current_user.role == 'user' else current_user.referrer.id,
        user_id_2=liked_user_id,
        matched_by_matcher=current_user.id if current_user.role == 'matchmaker' else None,
        status='pending'
    )
    if current_user.role == 'user':
        new_match.liked_by.append(current_user)
    else:
        new_match.liked_by.append(current_user.referrer)
    
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

            # other_user = match.user1 if match.user2.id == current_user.id else match.user2
            other_user = user1 if user2.id == linked_dater.id else user2

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
            other_user = user1 if (user2 and user2.id == current_user.id) else user2

            # Build the other user's dict
            user_dict = other_user.to_dict() if other_user else {}
            user_dict['first_image'] = other_user.images[0].image_url if other_user and other_user.images else None

            # By default no linked_dater for the current user's view
            linked_dater_dict = None

            # If the match was created/mediated by a matchmaker, only expose linked_dater
            # when the current_user is the linked dater (convention: match.user_id_1 was set to referred_dater_id)
            if match.matched_by_matcher:
                linked_dater_id = match.user_id_1  # convention: matchmaker-created matches set user_id_1 = referred_dater_id
                if linked_dater_id == current_user.id:
                    linked = User.query.get(linked_dater_id)
                    linked_dater_dict = linked.to_dict() if linked else None
                    if linked and linked.images:
                        linked_dater_dict['first_image'] = linked.images[0].image_url

            matched_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': linked_dater_dict,
                'blind_match': match.blind_match
            })

    return jsonify(matched_users)

@match_bp.route('/unmatch/<int:match_id>', methods=['DELETE'])
@token_required
def unmatch(current_user, match_id):
    match = Match.query.get(match_id)

    if not match:
        return jsonify({'message': 'Match not found'}), 404

    if current_user.id not in [match.user_id_1, match.user_id_2]:
        return jsonify({'message': 'Unauthorized'}), 403

    db.session.delete(match)
    db.session.commit()

    return jsonify({'message': 'Unmatched successfully'}), 200

@match_bp.route('/send_note', methods=['POST'])
@token_required
def send_note(current_user):
    data = request.get_json()
    recipient_id = data.get('recipient_id')
    note_text = data.get('note')

    if not recipient_id or not note_text:
        return jsonify({'message': 'recipient_id and note are required'}), 400

    recipient = User.query.get(recipient_id)
    if not recipient:
        return jsonify({'message': 'Recipient not found'}), 404

    match = Match.query.filter(
        ((Match.user_id_1 == current_user.id) & (Match.user_id_2 == recipient_id)) |
        ((Match.user_id_1 == recipient_id) & (Match.user_id_2 == current_user.id))
    ).first()

    if match:
        match.note = note_text
        match.status = 'pending'
    else: 
        match = Match(
            user_id_1=current_user.id if current_user.role == 'user' else current_user.referrer.id,
            user_id_2=recipient_id,
            matched_by_matcher=current_user.id if current_user.role == 'matchmaker' else None,
            status='pending',
            note=note_text
        )
        if current_user.role == 'user':
            match.liked_by.append(current_user)
        else:
            match.liked_by.append(current_user.referrer)
        db.session.add(match)

    db.session.commit()
    return jsonify({'message': 'Note sent successfully', 'match': match.to_dict()}), 201

