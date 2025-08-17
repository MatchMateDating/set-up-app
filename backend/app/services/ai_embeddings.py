# backend/app/services/ai_embeddings.py
from openai import OpenAI
import numpy as np
from app.models.messageDB import Message
from sqlalchemy import or_
import os
import dotenv
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_user_conversation_text(user_id: int, limit: int = 100) -> str:
    """
    Concatenates the most recent messages from a user for style analysis.
    """
    messages = Message.query.filter(
        Message.sender_id == user_id
    ).order_by(Message.timestamp.desc()).limit(limit).all()

    return " ".join([m.text for m in messages])


def get_embedding(text: str) -> list:
    """
    Calls OpenAI embeddings API and returns a vector.
    """
    if not text.strip():
        return [0] * 1536  # empty vector

    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )

    return response.data[0].embedding

def cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def get_conversation_similarity(user_a_id: int, user_b_id: int) -> float:
    """
    Returns cosine similarity (0–1) of conversation styles.
    """
    text_a = get_user_conversation_text(user_a_id)
    text_b = get_user_conversation_text(user_b_id)

    embedding_a = get_embedding(text_a)
    embedding_b = get_embedding(text_b)

    return cosine_similarity(embedding_a, embedding_b)

def explain_conversation_similarity(user_a_id: int, user_b_id: int) -> str:
    """
    Uses GPT to explain why two users have a certain conversation similarity score.
    """
    text_a = get_user_conversation_text(user_a_id)
    text_b = get_user_conversation_text(user_b_id)

    similarity_score = get_conversation_similarity(user_a_id, user_b_id)

    prompt = f"""
    Here are messages from User A:
    ---
    {text_a}

    Here are messages from User B:
    ---
    {text_b}

    The similarity score (based on embeddings) is {similarity_score:.2f}.

    Please explain in plain English why these two users have this similarity score.
    Focus on:
    - Writing style
    - Tone and formality
    - Common topics or interests
    - Pacing and message length
    - Any notable differences
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # or "gpt-4o" for higher quality 
        messages=[
            {"role": "system", "content": "You are a helpful conversation analyst."},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content


print(get_conversation_similarity(2,3))
print(explain_conversation_similarity(2, 3))
