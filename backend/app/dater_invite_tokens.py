"""Signed, time-limited tokens for matchmaker → dater web signup links."""
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app

SALT = 'matchmate-dater-invite-v1'
# Invites remain valid for 90 days from issuance (new tokens can be generated anytime).
MAX_AGE_SECONDS = 90 * 24 * 3600


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def encode_matchmaker_dater_invite(matchmaker_id: int) -> str:
    return _serializer().dumps({'mid': int(matchmaker_id)})


def decode_matchmaker_dater_invite(token: str):
    """Return matchmaker user id or None if invalid/expired."""
    if not token or not str(token).strip():
        return None
    try:
        data = _serializer().loads(str(token).strip(), max_age=MAX_AGE_SECONDS)
        mid = data.get('mid')
        return int(mid) if mid is not None else None
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None
