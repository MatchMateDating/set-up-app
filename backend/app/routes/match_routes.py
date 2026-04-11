from flask import Blueprint, jsonify, request
from app.models.userDB import User
from app.models.matchDB import Match
from app.models.conversationDB import Conversation
from app.models.messageDB import Message
from app.models.conversationReadStateDB import ConversationReadState
from app.models.skipDB import UserSkip
from app.models.blockDB import UserBlock
from app.models.conversationDB import Conversation
from app.models.messageDB import Message
from app import db
from app.routes.shared import token_required
from app.services.ai_embeddings import get_conversation_similarity
import math
from math import radians, sin, cos, sqrt, atan2
from app.services.notification_service import send_match_notification, send_note_notification

match_bp = Blueprint('match', __name__)

# Sentinel for "no distance limit" (matches anyone who fits other criteria, regardless of distance)
MATCH_ALL_RADIUS = 9999  # miles


def _unread_count_for_match(match_id, receiver_id):
    if receiver_id is None:
        return 0
    conversation = Conversation.query.filter_by(match_id=match_id).first()
    if not conversation:
        return 0

    read_state = ConversationReadState.query.filter_by(
        conversation_id=conversation.id,
        viewer_user_id=receiver_id
    ).first()
    last_read_message_id = read_state.last_read_message_id if read_state and read_state.last_read_message_id else 0

    return Message.query.filter(
        Message.conversation_id == conversation.id,
        Message.id > last_read_message_id,
        Message.sender_id != receiver_id
    ).count()

def haversine_distance(lat1, lon1, lat2, lon2):
    """Return distance between two coordinates in miles."""
    R = 3958.8  # Earth radius in miles
    if None in (lat1, lon1, lat2, lon2):
        return None
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

@match_bp.route('/users_to_match', methods=['GET'])
@token_required
def get_users_to_match(current_user):
    # Determine the acting user - for matchmakers, use their linked dater
    acting_user = current_user
    referred_dater_id = None
    if current_user.role == 'matchmaker' and current_user.referred_by_id:
        referred_dater_id = current_user.referred_by_id
        acting_user = User.query.get(referred_dater_id)
        if not acting_user:
            return jsonify([]), 404
    
    query = User.query.filter(
        User.role == 'user',
        User.id != acting_user.id,
        User.match_radius.isnot(None),
        User.match_radius > 0
    )

    # Add preferences filtering using acting_user (linked dater for matchmakers)
    # Age filtering
    if acting_user.preferredAgeMin and acting_user.preferredAgeMax:
        query = query.filter(User.age.between(
            acting_user.preferredAgeMin, 
            acting_user.preferredAgeMax
        ))

    # Gender filtering
    if acting_user.preferredGenders:
        query = query.filter(User.gender.in_(acting_user.preferredGenders))

    # If matchmaker, exclude their referred dater from the list
    if current_user.role == 'matchmaker' and referred_dater_id:
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

    if acting_user.role == 'user':
        existing_matches = Match.query.filter(
            ((Match.user_id_1 == acting_user.id) | (Match.user_id_2 == acting_user.id)) &
            (Match.status == 'matched')
        ).all()

        matched_user_ids = set()
        for match in existing_matches:
            if match.user_id_1 != acting_user.id:
                matched_user_ids.add(match.user_id_1)
            if match.user_id_2 != acting_user.id:
                matched_user_ids.add(match.user_id_2)

        query = query.filter(~User.id.in_(matched_user_ids))

        pending_likes = Match.query.filter(
            ((Match.user_id_1 == acting_user.id) | (Match.user_id_2 == acting_user.id)) &
            (Match.status == 'pending')
        ).all()

        pending_user_ids = set()
        for match in pending_likes:
            if any(u.id == acting_user.id for u in match.liked_by):
                if match.user_id_1 != acting_user.id:
                    pending_user_ids.add(match.user_id_1)
                if match.user_id_2 != acting_user.id:
                    pending_user_ids.add(match.user_id_2)

        query = query.filter(~User.id.in_(pending_user_ids))

        # Also filter out users from pending_approval matches (when matchmaker likes back)
        pending_approval_matches = Match.query.filter(
            ((Match.user_id_1 == acting_user.id) | (Match.user_id_2 == acting_user.id)) &
            (Match.status == 'pending_approval')
        ).all()

        pending_approval_user_ids = set()
        for match in pending_approval_matches:
            if any(u.id == acting_user.id for u in match.liked_by):
                if match.user_id_1 != acting_user.id:
                    pending_approval_user_ids.add(match.user_id_1)
                if match.user_id_2 != acting_user.id:
                    pending_approval_user_ids.add(match.user_id_2)

        query = query.filter(~User.id.in_(pending_approval_user_ids))

    users = query.all()
    
    # Get blocked user IDs (bidirectional - exclude if either user blocked the other)
    blocked_user_ids = set()
    # Users that the acting user has blocked
    blocks_by_acting = UserBlock.query.filter_by(blocker_id=acting_user.id).all()
    for block_record in blocks_by_acting:
        blocked_user_ids.add(block_record.blocked_id)
    # Users that have blocked the acting user
    blocks_of_acting = UserBlock.query.filter_by(blocked_id=acting_user.id).all()
    for block_record in blocks_of_acting:
        blocked_user_ids.add(block_record.blocker_id)
    
    # Get skipped user IDs for the acting user
    skipped_user_ids = set()
    skipped_records = UserSkip.query.filter_by(user_id=acting_user.id).all()
    for skip_record in skipped_records:
        skipped_user_ids.add(skip_record.skipped_user_id)
    
    # Separate users into non-skipped and skipped (exclude blocked users completely)
    non_skipped_users = []
    skipped_users = []
    for user in users:
        # Exclude blocked users completely (they won't appear at all)
        if user.id in blocked_user_ids:
            continue
        if user.id in skipped_user_ids:
            skipped_users.append(user)
        else:
            non_skipped_users.append(user)
    
    # Combine: non-skipped first, then skipped (skipped users go to the end)
    sorted_users = non_skipped_users + skipped_users
    
    users_data = []
    for user in sorted_users:
        # Use acting_user's location and radius (linked dater for matchmakers)
        if acting_user.latitude and acting_user.longitude and user.latitude and user.longitude:
            distance = haversine_distance(acting_user.latitude, acting_user.longitude,
                                          user.latitude, user.longitude)
            if distance is None:
                continue
            # user must be within acting_user's radius AND vice versa (unless either has "no distance limit")
            acting_radius = acting_user.match_radius if acting_user.match_radius else 0
            user_radius = user.match_radius if user.match_radius else 0
            if acting_radius == 0 or user_radius == 0:
                continue
            # treat radius >= MATCH_ALL_RADIUS as "no distance limit" for that user
            if (acting_radius < MATCH_ALL_RADIUS and distance > acting_radius) or (
                user_radius < MATCH_ALL_RADIUS and distance > user_radius
            ):
                continue
        # Check if user's age preferences match acting_user's age
        if acting_user.preferredAgeMin and acting_user.preferredAgeMax and user.preferredAgeMin and user.preferredAgeMax:
            if not (user.preferredAgeMin <= acting_user.age <= user.preferredAgeMax):
                continue
        # Check if user's gender preferences include acting_user's gender
        # If user has preferences, acting_user's gender must be in them
        # If user has no preferences, they're open to anyone (don't filter)
        if user.preferredGenders:
            if not acting_user.gender or acting_user.gender not in user.preferredGenders:
                continue
        liked_linked_dater = False
        note_text = None
        matched_by_matcher_user_1 = None
        matched_by_matcher_user_2 = None

        match = Match.query.filter(
            ((Match.user_id_1 == acting_user.id) & (Match.user_id_2 == user.id)) |
            ((Match.user_id_1 == user.id) & (Match.user_id_2 == acting_user.id))
        ).first()

        if match:
            if match.note:
                note_text = match.note
            # read the two matcher columns directly
            matched_by_matcher_user_1 = match.matched_by_user_id_1_matcher
            matched_by_matcher_user_2 = match.matched_by_user_id_2_matcher

        if current_user.role == 'matchmaker' and referred_dater_id:
            match = Match.query.filter(
                ((Match.user_id_1 == user.id) & (Match.user_id_2 == referred_dater_id)) |
                ((Match.user_id_1 == referred_dater_id) & (Match.user_id_2 == user.id))
            ).first()
            if match and any(u.id == referred_dater_id for u in match.liked_by) and not any(u.id == user.id for u in match.liked_by):
                liked_linked_dater = True

        user_dict = user.to_dict()
        user_dict['liked_linked_dater'] = liked_linked_dater
        user_dict['note'] = note_text
        user_dict['matched_by_matcher_user_1'] = matched_by_matcher_user_1
        user_dict['matched_by_matcher_user_2'] = matched_by_matcher_user_2
        if current_user.role == 'matchmaker' and referred_dater_id:
            try:
                ai_score = get_conversation_similarity(referred_dater_id, user.id)
                if ai_score is None or math.isnan(ai_score):
                    user_dict['ai_score'] = 0.0
                else:
                    user_dict['ai_score'] = round(float(ai_score), 2)
            except Exception as e:
                print(f"Error computing AI score for users {referred_dater_id} and {user.id}: {e}")
                user_dict['ai_score'] = None
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

    # For now, assume they selected one linked dater in the UI
    # (you can expand this later if your frontend lets the matchmaker pick)
    referred_dater_id = current_user.referred_by_id
    if not referred_dater_id:
        return jsonify({'message': 'Matchmaker has no linked dater'}), 400

    existing_match = Match.query.filter(
        ((Match.user_id_1 == referred_dater_id) & (Match.user_id_2 == liked_user_id)) |
        ((Match.user_id_1 == liked_user_id) & (Match.user_id_2 == referred_dater_id))
    ).first()

    if existing_match:
        existing_match.status = 'pending_approval'
        # set the proper matched_by_user_id_X_matcher depending on which side is the linked dater
        if existing_match.user_id_1 == referred_dater_id:
            existing_match.matched_by_user_id_1_matcher = current_user.id
        else:
            existing_match.matched_by_user_id_2_matcher = current_user.id
        existing_match.blind_match = 'Blind'
        # Add both users to liked_by if not already there
        referred_dater = User.query.get(referred_dater_id)
        liked_user = User.query.get(liked_user_id)
        if referred_dater and referred_dater not in existing_match.liked_by:
            existing_match.liked_by.append(referred_dater)
        if liked_user and liked_user not in existing_match.liked_by:
            existing_match.liked_by.append(liked_user)
    else:
        new_match = Match(
            user_id_1=referred_dater_id,
            user_id_2=liked_user_id,
            matched_by_user_id_1_matcher=current_user.id,
            status='pending_approval',
            blind_match='Blind'
        )
        # Add both users to liked_by
        referred_dater = User.query.get(referred_dater_id)
        liked_user = User.query.get(liked_user_id)
        if referred_dater:
            new_match.liked_by.append(referred_dater)
        if liked_user:
            new_match.liked_by.append(liked_user)
        db.session.add(new_match)

    db.session.commit()
    
    # Send push notifications to both users about the new match
    try:
        # Get user names for notifications
        referred_dater = User.query.get(referred_dater_id)
        liked_user = User.query.get(liked_user_id)
        
        if referred_dater and liked_user:
            # Notify the referred dater
            other_name = liked_user.first_name or 'Someone'
            send_match_notification(
                referred_dater_id,
                new_match.id if not existing_match else existing_match.id,
                other_name,
                is_blind_match=True,
            )
            
            # Notify the liked user
            other_name = referred_dater.first_name or 'Someone'
            send_match_notification(
                liked_user_id,
                new_match.id if not existing_match else existing_match.id,
                other_name,
                is_blind_match=True,
            )
    except Exception as e:
        # Log error but don't fail the request
        print(f"Error sending match notifications: {e}")
    
    match_obj = existing_match if existing_match else new_match
    return jsonify({'message': 'Blind match created successfully', 'match': match_obj.to_dict()}), 201


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

    # Determine acting dater id and the actual User object to add to liked_by
    if current_user.role == 'user':
        acting_dater_id = current_user.id
        liker_user = current_user
    else:
        acting_dater_id = current_user.referred_by_id
        if not acting_dater_id:
            return jsonify({'message': 'Matchmaker has no linked dater'}), 400
        liker_user = User.query.get(acting_dater_id)
        if not liker_user:
            return jsonify({'message': 'Linked dater not found'}), 404

    # Find existing match between acting_dater and liked_user
    existing_match = Match.query.filter(
        ((Match.user_id_1 == acting_dater_id) & (Match.user_id_2 == liked_user_id)) |
        ((Match.user_id_1 == liked_user_id) & (Match.user_id_2 == acting_dater_id))
    ).first()

    print(f"Existing match found: {existing_match.to_dict() if existing_match else 'None'}")

    if existing_match:
        existing_liked_ids = {u.id for u in existing_match.liked_by}
        # Append the correct User object into liked_by if not already present
        if liker_user not in existing_match.liked_by:
            existing_match.liked_by.append(liker_user)
            print(f"Added User {liker_user.id} to liked_by list")

        # If a matchmaker initiated this like, record which matcher was involved on the correct side
        # Do this BEFORE checking status so we know if matchmakers are involved
        if current_user.role == 'matchmaker':
            if existing_match.user_id_1 == acting_dater_id:
                existing_match.matched_by_user_id_1_matcher = current_user.id
            elif existing_match.user_id_2 == acting_dater_id:
                existing_match.matched_by_user_id_2_matcher = current_user.id
            else:
                # Defensive: log if neither side matches (shouldn't happen)
                print(f"Warning: acting_dater_id {acting_dater_id} is on neither side of match {existing_match.id}")

        # If this like makes both sides present in liked_by, check if matchmaker involved
        liked_ids = {u.id for u in existing_match.liked_by}
        if existing_match.user_id_1 in liked_ids and existing_match.user_id_2 in liked_ids:
            # If matchmaker(s) involved, set to pending_approval, otherwise matched
            if existing_match.matched_by_user_id_1_matcher or existing_match.matched_by_user_id_2_matcher:
                existing_match.status = 'pending_approval'
                print(f"Match between User {existing_match.user_id_1} and User {existing_match.user_id_2} is now pending approval!")
            else:
                existing_match.status = 'matched'
                print(f"Match between User {existing_match.user_id_1} and User {existing_match.user_id_2} is now mutual!") 

        db.session.add(existing_match)
        db.session.commit()
        
        # Send push notifications when match becomes mutual or pending_approval
        if existing_match.user_id_1 in liked_ids and existing_match.user_id_2 in liked_ids:
            try:
                from app.services.notification_service import send_match_notification
                
                user1 = User.query.get(existing_match.user_id_1)
                user2 = User.query.get(existing_match.user_id_2)
                
                if user1 and user2:
                    # Notify user1
                    other_name = user2.first_name or 'Someone'
                    send_match_notification(existing_match.user_id_1, existing_match.id, other_name)
                    
                    # Notify user2
                    other_name = user1.first_name or 'Someone'
                    send_match_notification(existing_match.user_id_2, existing_match.id, other_name)
            except Exception as e:
                # Log error but don't fail the request
                print(f"Error sending match notifications: {e}")
        
        return jsonify({'message': 'Like processed', 'match': existing_match.to_dict()}), 200

    # No existing match — create new pending match where user_id_1 is acting_dater_id
    new_match = Match(
        user_id_1=acting_dater_id,
        user_id_2=liked_user_id,
        status='pending'
    )

    # Record the liker in liked_by
    new_match.liked_by.append(liker_user)

    # If matchmaker initiated, set the matched_by_user_id_1_matcher on the side we stored acting_dater_id
    if current_user.role == 'matchmaker':
        if new_match.user_id_1 == acting_dater_id:
            new_match.matched_by_user_id_1_matcher = current_user.id
        elif new_match.user_id_2 == acting_dater_id:
            new_match.matched_by_user_id_2_matcher = current_user.id

    db.session.add(new_match)
    db.session.commit()

    print(f"New pending like created: {new_match.to_dict()}")
    return jsonify(new_match.to_dict()), 201

@match_bp.route('/matches', methods=['GET'])
@token_required
def get_mutual_matches(current_user):
    print(f"Fetching matches for User {current_user.id} or type {current_user.role}")
    matched_users = []
    pending_approval_users = []

    if current_user.role == 'matchmaker':
        linked_dater_id = current_user.referred_by_id
        linked_user = User.query.get(linked_dater_id)
        if not linked_dater_id:
            return jsonify({'matched': matched_users, 'pending_approval': pending_approval_users})
        
        print(f"linked_dater: {linked_dater_id} for matchmaker {current_user.id}")
        
        # Get approved matches
        approved_matches = Match.query.filter(
            ((Match.user_id_1 == linked_dater_id) | (Match.user_id_2 == linked_dater_id)) &
            (Match.status == 'matched') & 
            ((Match.matched_by_user_id_1_matcher == current_user.id) | 
             (Match.matched_by_user_id_2_matcher == current_user.id))
        ).all()

        for match in approved_matches:
            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = user1 if (user2 and user2.id == linked_dater_id) else user2
            if not other_user:
                other_user = user1 or user2

            user_dict = other_user.to_dict()
            linked_dater_dict = linked_user.to_dict()

            user_dict['first_image'] = other_user.images[0].image_url if other_user and other_user.images else None
            linked_dater_dict['first_image'] = linked_user.images[0].image_url if linked_user.images else None
            both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
            user1_matchmaker_involved = bool(match.matched_by_user_id_1_matcher)
            user2_matchmaker_involved = bool(match.matched_by_user_id_2_matcher)
            if match.user_id_1 == linked_dater_id:
                other_matchmaker_involved = user2_matchmaker_involved
            else:
                other_matchmaker_involved = user1_matchmaker_involved
            matched_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': linked_dater_dict,
                'blind_match': match.blind_match,
                'unread_count': _unread_count_for_match(match.id, current_user.id),
                'user_1_matchmaker_involved': user1_matchmaker_involved,
                'user_2_matchmaker_involved': user2_matchmaker_involved,
                'both_matchmakers_involved': both_matchmakers_involved,
                'other_matchmaker_involved': other_matchmaker_involved,
            })

        # Get pending approval matches - only show if this matchmaker is involved
        pending_matches = Match.query.filter(
            ((Match.user_id_1 == linked_dater_id) | (Match.user_id_2 == linked_dater_id)) &
            (Match.status == 'pending_approval') & 
            ((Match.matched_by_user_id_1_matcher == current_user.id) | 
             (Match.matched_by_user_id_2_matcher == current_user.id))
        ).all()

        for match in pending_matches:
            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = user1 if (user2 and user2.id == linked_dater_id) else user2
            if not other_user:
                other_user = user1 or user2

            user_dict = other_user.to_dict()
            linked_dater_dict = linked_user.to_dict()

            user_dict['first_image'] = other_user.images[0].image_url if other_user and other_user.images else None
            linked_dater_dict['first_image'] = linked_user.images[0].image_url if linked_user.images else None
            
            # Determine the correct message count for this matchmaker
            if match.matched_by_user_id_1_matcher == current_user.id:
                message_count = match.message_count_matcher_1 or 0
                approved_by_current = match.approved_by_matcher_1 or False
                approved_by_other = match.approved_by_matcher_2 or False
                both_matchmakers = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
                waiting_for_other = both_matchmakers and approved_by_current and not (match.approved_by_matcher_2 or False)
            elif match.matched_by_user_id_2_matcher == current_user.id:
                message_count = match.message_count_matcher_2 or 0
                approved_by_current = match.approved_by_matcher_2 or False
                approved_by_other = match.approved_by_matcher_1 or False
                both_matchmakers = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
                waiting_for_other = both_matchmakers and approved_by_current and not (match.approved_by_matcher_1 or False)
            else:
                # Fallback to legacy message_count if neither matchmaker is set
                message_count = match.message_count or 0
                approved_by_current = False
                approved_by_other = False
                waiting_for_other = False
            
            # Determine matchmaker involvement fields
            both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
            user1_matchmaker_involved = bool(match.matched_by_user_id_1_matcher)
            user2_matchmaker_involved = bool(match.matched_by_user_id_2_matcher)
            if match.user_id_1 == linked_dater_id:
                other_matchmaker_involved = user2_matchmaker_involved
            else:
                other_matchmaker_involved = user1_matchmaker_involved
            
            pending_approval_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': linked_dater_dict,
                'blind_match': match.blind_match,
                'status': match.status,
                'unread_count': _unread_count_for_match(match.id, current_user.id),
                'message_count': message_count,
                'waiting_for_other_approval': waiting_for_other,
                'approved_by_other_matchmaker': both_matchmakers_involved and approved_by_other and not approved_by_current,
                'user_1_matchmaker_involved': user1_matchmaker_involved,
                'user_2_matchmaker_involved': user2_matchmaker_involved,
                'both_matchmakers_involved': both_matchmakers_involved,
                'other_matchmaker_involved': other_matchmaker_involved,
            })

        return jsonify({'matched': matched_users, 'pending_approval': pending_approval_users})
    
    elif current_user.role == 'user':
        # Get approved matches
        approved_matches = Match.query.filter(
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id)) &
            (Match.status == 'matched')
        ).all()

        for match in approved_matches:
            # Determine whether both matchmakers were involved
            both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
            user1_matchmaker_involved = bool(match.matched_by_user_id_1_matcher)
            user2_matchmaker_involved = bool(match.matched_by_user_id_2_matcher)
            current_is_user1 = match.user_id_1 == current_user.id
            other_matchmaker_involved = (
                user2_matchmaker_involved if current_is_user1 else user1_matchmaker_involved
            )

            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = user1 if (user2 and user2.id == current_user.id) else user2

            user_dict = other_user.to_dict() if other_user else {}
            user_dict['first_image'] = other_user.images[0].image_url if other_user and other_user.images else None

            # By default no linked_dater for this user's view
            linked_dater_dict = None

            # If the match was created/mediated by a matchmaker, determine which side was the linked dater
            if match.matched_by_user_id_1_matcher or match.matched_by_user_id_2_matcher:
                linked_dater_id = match.user_id_1 if match.matched_by_user_id_1_matcher else match.user_id_2
                if linked_dater_id == current_user.id:
                    linked = User.query.get(linked_dater_id)
                    linked_dater_dict = linked.to_dict() if linked else None
                    if linked and linked.images: 
                        linked_dater_dict['first_image'] = linked.images[0].image_url

            matched_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': linked_dater_dict,
                'blind_match': match.blind_match,
                'unread_count': _unread_count_for_match(match.id, current_user.id),
                'user_1_matchmaker_involved': user1_matchmaker_involved,
                'user_2_matchmaker_involved': user2_matchmaker_involved,
                'both_matchmakers_involved': both_matchmakers_involved,
                'other_matchmaker_involved': other_matchmaker_involved,
            })

        # Get pending_approval matches - only show if current_user directly liked (is in liked_by)
        pending_matches = Match.query.filter(
            ((Match.user_id_1 == current_user.id) | (Match.user_id_2 == current_user.id)) &
            (Match.status == 'pending_approval')
        ).all()

        for match in pending_matches:
            # Only show if current_user is in liked_by (they directly liked)
            liked_ids = {u.id for u in match.liked_by}
            if current_user.id not in liked_ids:
                continue

            user1 = User.query.get(match.user_id_1)
            user2 = User.query.get(match.user_id_2)
            other_user = user1 if (user2 and user2.id == current_user.id) else user2

            user_dict = other_user.to_dict() if other_user else {}
            user_dict['first_image'] = other_user.images[0].image_url if other_user and other_user.images else None

            # Determine whether matchmakers were involved
            both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
            user1_matchmaker_involved = bool(match.matched_by_user_id_1_matcher)
            user2_matchmaker_involved = bool(match.matched_by_user_id_2_matcher)
            current_is_user1 = match.user_id_1 == current_user.id
            other_matchmaker_involved = (
                user2_matchmaker_involved if current_is_user1 else user1_matchmaker_involved
            )

            # For single-matchmaker pending approvals, only show to the dater who does
            # NOT have a matchmaker (the direct dater participant). Hide from the
            # matchmaker-backed dater until approval is complete.
            single_matchmaker_involved = user1_matchmaker_involved != user2_matchmaker_involved
            if single_matchmaker_involved:
                current_user_is_user1 = match.user_id_1 == current_user.id
                current_user_is_user2 = match.user_id_2 == current_user.id
                current_user_has_matchmaker = (
                    (current_user_is_user1 and user1_matchmaker_involved) or
                    (current_user_is_user2 and user2_matchmaker_involved)
                )
                if current_user_has_matchmaker:
                    continue

            pending_approval_users.append({
                'match_id': match.id,
                'match_user': user_dict,
                'linked_dater': None,
                'blind_match': match.blind_match,
                'status': 'pending_approval',
                'unread_count': _unread_count_for_match(match.id, current_user.id),
                'user_1_matchmaker_involved': user1_matchmaker_involved,
                'user_2_matchmaker_involved': user2_matchmaker_involved,
                'both_matchmakers_involved': both_matchmakers_involved,
                'other_matchmaker_involved': other_matchmaker_involved,
            })

    return jsonify({'matched': matched_users, 'pending_approval': pending_approval_users})

@match_bp.route('/unmatch/<int:match_id>', methods=['DELETE'])
@token_required
def unmatch(current_user, match_id):
    match = Match.query.get(match_id)

    if not match:
        return jsonify({'message': 'Match not found'}), 404

    # Check authorization based on user role
    if current_user.role == 'user':
        # Regular users can only unmatch if they are one of the users in the match
        if current_user.id not in [match.user_id_1, match.user_id_2]:
            return jsonify({'message': 'Unauthorized'}), 403
    elif current_user.role == 'matchmaker':
        # Matchmakers can unmatch if the match involves their linked dater
        linked_dater_id = current_user.referred_by_id
        if not linked_dater_id:
            return jsonify({'message': 'Matchmaker has no linked dater'}), 403
        
        if match.user_id_1 != linked_dater_id and match.user_id_2 != linked_dater_id:
            return jsonify({'message': 'Match does not involve your linked dater'}), 403
        
        # Also check if this matchmaker is involved in the match
        if match.matched_by_user_id_1_matcher != current_user.id and match.matched_by_user_id_2_matcher != current_user.id:
            return jsonify({'message': 'You are not authorized to unmatch this match'}), 403

    # Delete conversations (and their messages) that reference this match before deleting the match
    conversations = Conversation.query.filter_by(match_id=match_id).all()
    for conversation in conversations:
        Message.query.filter_by(conversation_id=conversation.id).delete()
        db.session.delete(conversation)
    db.session.delete(match)
    db.session.commit()

    return jsonify({'message': 'Unmatched successfully'}), 200

@match_bp.route('/reveal/<int:match_id>', methods=['PATCH'])
@token_required
def reveal_match(current_user, match_id):
    # Only matchmakers can reveal
    if current_user.role != 'matchmaker':
        return jsonify({'message': 'Only matchmakers can reveal blind matches.'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'message': 'Match not found.'}), 404

    # Ensure this match belongs to one of their linked daters
    linked_dater_id = current_user.referred_by_id
    linked_dater = User.query.get(linked_dater_id)
    if not linked_dater:
        return jsonify({'message': 'Matchmaker has no linked dater.'}), 403

    if match.user_id_1 != linked_dater.id and match.user_id_2 != linked_dater.id:
        return jsonify({'message': 'Match does not involve your linked dater.'}), 403

    # Update the match
    match.blind_match = 'Revealed'
    db.session.commit()

    return jsonify({
        'message': 'Match revealed successfully.', 
        'match_id': match.id,
        'blind_match': match.blind_match})

@match_bp.route('/hide/<int:match_id>', methods=['PATCH'])
@token_required
def hide_match(current_user, match_id):
    # Only matchmakers can hide
    if current_user.role != 'matchmaker':
        return jsonify({'message': 'Only matchmakers can hide blind matches.'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'message': 'Match not found.'}), 404

    # Ensure this match belongs to one of their linked daters
    linked_dater_id = current_user.referred_by_id
    linked_dater = User.query.get(linked_dater_id)
    if not linked_dater:
        return jsonify({'message': 'Matchmaker has no linked dater.'}), 403

    if match.user_id_1 != linked_dater.id and match.user_id_2 != linked_dater.id:
        return jsonify({'message': 'Match does not involve your linked dater.'}), 403

    # Update the match
    match.blind_match = 'Blind'
    db.session.commit()

    return jsonify({
        'message': 'Match hidden successfully.', 
        'match_id': match.id,
        'blind_match': match.blind_match})


@match_bp.route('/approve/<int:match_id>', methods=['POST'])
@token_required
def approve_match(current_user, match_id):
    # Only matchmakers can approve
    if current_user.role != 'matchmaker':
        return jsonify({'message': 'Only matchmakers can approve matches.'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'message': 'Match not found.'}), 404

    # Ensure this match belongs to one of their linked daters and this matchmaker is involved
    linked_dater_id = current_user.referred_by_id
    if not linked_dater_id:
        return jsonify({'message': 'Matchmaker has no linked dater.'}), 403

    if match.user_id_1 != linked_dater_id and match.user_id_2 != linked_dater_id:
        return jsonify({'message': 'Match does not involve your linked dater.'}), 403

    # Check if this matchmaker is involved in the match
    if match.matched_by_user_id_1_matcher != current_user.id and match.matched_by_user_id_2_matcher != current_user.id:
        return jsonify({'message': 'You are not authorized to approve this match.'}), 403

    if match.status != 'pending_approval':
        return jsonify({'message': 'Match is not in pending approval status.'}), 400

    # Check if both matchmakers are involved
    both_matchmakers_involved = bool(match.matched_by_user_id_1_matcher and match.matched_by_user_id_2_matcher)
    
    if both_matchmakers_involved:
        # Mark this matchmaker as having approved
        if match.matched_by_user_id_1_matcher == current_user.id:
            match.approved_by_matcher_1 = True
        elif match.matched_by_user_id_2_matcher == current_user.id:
            match.approved_by_matcher_2 = True
        
        # Check if both matchmakers have approved
        if match.approved_by_matcher_1 and match.approved_by_matcher_2:
            match.status = 'matched'
            db.session.commit()
            return jsonify({
                'message': 'Match approved successfully by both matchmakers.', 
                'match_id': match.id,
                'status': match.status
            }), 200
        else:
            # One matchmaker has approved, waiting for the other
            db.session.commit()
            return jsonify({
                'message': 'Your approval has been recorded. Waiting for the other matchmaker to approve.', 
                'match_id': match.id,
                'status': match.status,
                'waiting_for_other': True
            }), 200
    else:
        # Only one matchmaker involved, approve immediately
        match.status = 'matched'
        db.session.commit()
        return jsonify({
            'message': 'Match approved successfully.', 
            'match_id': match.id,
            'status': match.status
        }), 200

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

    # Determine acting dater and sender user for liked_by relationship.
    if current_user.role == 'user':
        acting_dater_id = current_user.id
        sender_user = current_user
    else:
        acting_dater_id = current_user.referred_by_id
        if not acting_dater_id:
            return jsonify({'message': 'Matchmaker has no linked dater'}), 400
        sender_user = User.query.get(acting_dater_id)
        if not sender_user:
            return jsonify({'message': 'Linked dater not found'}), 404

    if acting_dater_id == recipient_id:
        return jsonify({'message': 'Cannot send a note to yourself'}), 400

    match = Match.query.filter(
        ((Match.user_id_1 == acting_dater_id) & (Match.user_id_2 == recipient_id)) |
        ((Match.user_id_1 == recipient_id) & (Match.user_id_2 == acting_dater_id))
    ).first()

    if match:
        match.note = note_text
        # Notes should always create/update a normal (non-blind) match.
        match.blind_match = ''
        if current_user.role == 'matchmaker':
            if match.user_id_1 == acting_dater_id:
                match.matched_by_user_id_1_matcher = current_user.id
            elif match.user_id_2 == acting_dater_id:
                match.matched_by_user_id_2_matcher = current_user.id
        if sender_user not in match.liked_by:
            match.liked_by.append(sender_user)
    else:
        match = Match(
            user_id_1=acting_dater_id,
            user_id_2=recipient_id,
            status='pending',
            note=note_text,
            blind_match=''
        )
        match.liked_by.append(sender_user)
        if current_user.role == 'matchmaker':
            # record which matchmaker created this entry on the correct side
            if match.user_id_1 == current_user.referred_by_id:
                match.matched_by_user_id_1_matcher = current_user.id
            elif match.user_id_2 == current_user.referred_by_id:
                match.matched_by_user_id_2_matcher = current_user.id

        db.session.add(match)
        db.session.flush()

    # Recompute status after recording this note sender in liked_by.
    liked_ids = {u.id for u in match.liked_by}
    both_sides_liked = match.user_id_1 in liked_ids and match.user_id_2 in liked_ids
    matchmaker_involved = bool(match.matched_by_user_id_1_matcher or match.matched_by_user_id_2_matcher)
    if both_sides_liked:
        match.status = 'pending_approval' if matchmaker_involved else 'matched'
    else:
        match.status = 'pending'

    # Persist each note as a conversation message so both notes remain visible.
    conversation = Conversation.query.filter_by(match_id=match.id).first()
    if not conversation:
        conversation = Conversation(match_id=match.id)
        db.session.add(conversation)
        db.session.flush()

    note_message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        receiver_id=recipient_id,
        text=note_text,
        read=False
    )
    db.session.add(note_message)

    db.session.commit()

    try:
        sender_name = sender_user.first_name or current_user.first_name or 'Someone'
        send_note_notification(recipient_id, sender_name, match.id, note_text)
    except Exception as e:
        print(f"Error sending note notification: {e}")

    return jsonify({'message': 'Note sent successfully', 'match': match.to_dict()}), 201

@match_bp.route('/skip/<int:skipped_user_id>', methods=['POST'])
@token_required
def skip_user(current_user, skipped_user_id):
    # Determine the acting user - for matchmakers, use their linked dater
    acting_user_id = current_user.id
    if current_user.role == 'matchmaker':
        if not current_user.referred_by_id:
            return jsonify({'message': 'Matchmaker has no linked dater'}), 400
        acting_user_id = current_user.referred_by_id
    
    if acting_user_id == skipped_user_id:
        return jsonify({'message': 'Cannot skip yourself'}), 400
    
    # Check if skip already exists
    existing_skip = UserSkip.query.filter_by(
        user_id=acting_user_id,
        skipped_user_id=skipped_user_id
    ).first()
    
    if existing_skip:
        return jsonify({'message': 'User already skipped'}), 200
    
    # Create new skip record
    new_skip = UserSkip(
        user_id=acting_user_id,
        skipped_user_id=skipped_user_id
    )
    db.session.add(new_skip)
    db.session.commit()
    
    return jsonify({'message': 'User skipped successfully'}), 201

@match_bp.route('/block/<int:blocked_user_id>', methods=['POST'])
@token_required
def block_user(current_user, blocked_user_id):
    # Only regular users (daters) can block, not matchmakers
    if current_user.role != 'user':
        return jsonify({'message': 'Only daters can block users'}), 403
    
    if current_user.id == blocked_user_id:
        return jsonify({'message': 'Cannot block yourself'}), 400
    
    # Check if block already exists
    existing_block = UserBlock.query.filter_by(
        blocker_id=current_user.id,
        blocked_id=blocked_user_id
    ).first()
    
    if existing_block:
        return jsonify({'message': 'User already blocked'}), 200
    
    # Create new block record
    new_block = UserBlock(
        blocker_id=current_user.id,
        blocked_id=blocked_user_id
    )
    db.session.add(new_block)
    db.session.commit()
    
    return jsonify({'message': 'User blocked successfully'}), 201
