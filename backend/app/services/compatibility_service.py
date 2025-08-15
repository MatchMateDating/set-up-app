# backend/app/services/compatibility_service.py
from ...app.services.ai_embeddings import get_conversation_similarity
from ...app.models.userDB import User

def calculate_profile_score(user_a: User, user_b: User) -> int:
    """
    Rule-based profile match score between 0–50.
    Compares traits of one user to preferences of the other and vice versa.
    """
    score = 0
    max_score = 50

    # Example: hobbies match
    if set(user_a.hobbies).intersection(set(user_b.preferences.get("hobbies", []))):
        score += 10

    # Example: personality match
    if user_a.personality in user_b.preferences.get("personalities", []):
        score += 10

    # Example: lifestyle match
    if user_a.lifestyle == user_b.preferences.get("lifestyle"):
        score += 10

    # Example: age range check
    if user_b.preferences.get("min_age") <= user_a.age <= user_b.preferences.get("max_age"):
        score += 10

    # Example: location match
    if user_a.location == user_b.preferences.get("location"):
        score += 10

    return min(score, max_score)

def calculate_conversation_score(user_a_id: int, user_b_id: int) -> int:
    """
    AI-based conversation style similarity score between 0–50.
    """
    similarity = get_conversation_similarity(user_a_id, user_b_id)
    return int(similarity * 50)  # cosine similarity (0–1) → 0–50

def calculate_total_compatibility(user_a: User, user_b: User) -> dict:
    """
    Combines profile score + conversation score into a total.
    """
    profile_score = calculate_profile_score(user_a, user_b)
    conversation_score = calculate_conversation_score(user_a.id, user_b.id)

    total_score = profile_score + conversation_score

    return {
        "profile_score": profile_score,
        "conversation_score": conversation_score,
        "total_score": total_score
    }
