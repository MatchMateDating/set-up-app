# app/services/push_platforms.py — direct APNs (iOS) and FCM (Android) sends
import base64
import binascii
import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional

import httpx
import jwt

logger = logging.getLogger(__name__)


class InvalidPushToken(Exception):
    """Raised when the provider reports the token is no longer valid (prune DB row)."""


def _push_config() -> Dict[str, Any]:
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            c = current_app.config
            return {
                "APNS_KEY_PATH": c.get("APNS_KEY_PATH"),
                "APNS_KEY_CONTENT": c.get("APNS_KEY_CONTENT"),
                "APNS_KEY_ID": c.get("APNS_KEY_ID"),
                "APNS_TEAM_ID": c.get("APNS_TEAM_ID"),
                "APNS_TOPIC": c.get("APNS_TOPIC"),
                "APNS_USE_SANDBOX": c.get("APNS_USE_SANDBOX", False),
                "FIREBASE_CREDENTIALS_PATH": c.get("FIREBASE_CREDENTIALS_PATH"),
                "FIREBASE_CREDENTIALS_JSON": c.get("FIREBASE_CREDENTIALS_JSON"),
            }
    except Exception:
        pass
    return {
        "APNS_KEY_PATH": os.environ.get("APNS_KEY_PATH"),
        "APNS_KEY_CONTENT": os.environ.get("APNS_KEY_CONTENT"),
        "APNS_KEY_ID": os.environ.get("APNS_KEY_ID"),
        "APNS_TEAM_ID": os.environ.get("APNS_TEAM_ID"),
        "APNS_TOPIC": os.environ.get("APNS_TOPIC"),
        "APNS_USE_SANDBOX": os.getenv("APNS_USE_SANDBOX", "false").lower()
        in ("1", "true", "yes"),
        "FIREBASE_CREDENTIALS_PATH": os.environ.get("FIREBASE_CREDENTIALS_PATH"),
        "FIREBASE_CREDENTIALS_JSON": os.environ.get("FIREBASE_CREDENTIALS_JSON"),
    }


def _apns_key_material(cfg: Dict[str, Any]) -> Optional[str]:
    raw = cfg.get("APNS_KEY_CONTENT")
    if raw and str(raw).strip():
        return str(raw).strip()
    path = cfg.get("APNS_KEY_PATH")
    if path and os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return None


def apns_configured(cfg: Optional[Dict[str, Any]] = None) -> bool:
    cfg = cfg or _push_config()
    return bool(
        _apns_key_material(cfg)
        and cfg.get("APNS_KEY_ID")
        and cfg.get("APNS_TEAM_ID")
        and cfg.get("APNS_TOPIC")
    )


def _normalize_apns_device_token(token: str) -> str:
    """
    APNs HTTP/2 path expects the device token as 64 hex chars (32 bytes).
    Clients may send hex with separators, or base64-encoded 32 bytes (e.g. some Expo/RN paths).
    """
    if not token:
        return ""
    s = str(token).strip()

    hex_only = re.sub(r"[^0-9a-fA-F]", "", s)
    if len(hex_only) == 64:
        return hex_only.lower()

    # Base64 or URL-safe base64 of 32 raw bytes (common when not pre-hexed)
    for decoder in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            pad = s + "=" * ((4 - len(s) % 4) % 4)
            raw = decoder(pad)
            if len(raw) == 32:
                return raw.hex()
        except (binascii.Error, ValueError):
            continue

    return hex_only.lower()


def _ensure_firebase(cfg: Dict[str, Any]) -> bool:
    path = cfg.get("FIREBASE_CREDENTIALS_PATH")
    raw = cfg.get("FIREBASE_CREDENTIALS_JSON")
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning("firebase-admin not installed")
        return False

    cred = None
    if path and os.path.isfile(path):
        cred = credentials.Certificate(path)
    elif raw and str(raw).strip():
        cred = credentials.Certificate(json.loads(raw))
    if not cred:
        return False
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
    return True


def send_apns(
    device_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Send via APNs HTTP/2. Returns True on success. Raises InvalidPushToken when token is dead.
    Returns False if APNs is not configured or send failed (non-fatal).
    """
    cfg = _push_config()
    if not apns_configured(cfg):
        has_key = bool(_apns_key_material(cfg))
        logger.warning(
            "APNs not configured; skipping native iOS push (has_key_material=%s key_id=%s team_id=%s topic=%s)",
            has_key,
            cfg.get("APNS_KEY_ID"),
            cfg.get("APNS_TEAM_ID"),
            cfg.get("APNS_TOPIC"),
        )
        return False

    key_content = _apns_key_material(cfg)
    if not key_content:
        logger.warning("APNs key material missing; skipping native iOS push")
        return False

    key_id = cfg["APNS_KEY_ID"]
    team_id = cfg["APNS_TEAM_ID"]
    topic = cfg["APNS_TOPIC"]
    use_sandbox = bool(cfg.get("APNS_USE_SANDBOX"))

    normalized_token = _normalize_apns_device_token(device_token)
    if not normalized_token:
        raise InvalidPushToken("empty device token")
    if len(normalized_token) != 64:
        logger.warning(
            "APNs device token hex length is %s (expected 64); token may be wrong format or Expo Go (use a dev build with your bundle id)",
            len(normalized_token),
        )

    auth_token = jwt.encode(
        {"iss": team_id, "iat": int(time.time())},
        key_content,
        algorithm="ES256",
        headers={"kid": key_id, "alg": "ES256"},
    )
    if isinstance(auth_token, bytes):
        auth_token = auth_token.decode("utf-8")

    host = "api.sandbox.push.apple.com" if use_sandbox else "api.push.apple.com"
    url = f"https://{host}/3/device/{normalized_token}"

    token_prefix = (
        f"{normalized_token[:12]}…" if len(normalized_token) > 12 else normalized_token
    )
    logger.info(
        "APNs send: host=%s APNS_USE_SANDBOX=%s apns-topic=%s key_id=%s team_id=%s "
        "device_token_hex_len=%s device_token_prefix=%s",
        host,
        use_sandbox,
        topic,
        key_id,
        team_id,
        len(normalized_token),
        token_prefix,
    )

    payload: Dict[str, Any] = {
        "aps": {
            "alert": {"title": title, "body": body},
            "sound": "default",
        }
    }
    for k, v in (data or {}).items():
        if v is None:
            continue
        payload[str(k)] = v if isinstance(v, (str, int, float, bool)) else str(v)

    headers = {
        "authorization": f"bearer {auth_token}",
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
    }

    with httpx.Client(http2=True, timeout=30.0) as client:
        r = client.post(url, headers=headers, json=payload)

    if r.status_code == 410:
        raise InvalidPushToken("APNs unregistered")
    if r.status_code == 200:
        return True
    text_lower = (r.text or "").lower()
    if r.status_code in (400, 404) and (
        "unregistered" in text_lower
        or "baddevicetoken" in text_lower
        or "device token" in text_lower
    ):
        raise InvalidPushToken(r.text)
    logger.warning("APNs send failed: %s %s", r.status_code, r.text[:500])
    return False


def send_fcm(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    cfg = _push_config()
    if not _ensure_firebase(cfg):
        logger.warning("FCM not configured; skipping native Android push")
        return False

    from firebase_admin import messaging

    data_str = {
        str(k): str(v) if v is not None else ""
        for k, v in (data or {}).items()
    }

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data=data_str,
        token=fcm_token.strip(),
        android=messaging.AndroidConfig(priority="high"),
    )
    try:
        messaging.send(message)
        return True
    except Exception as e:
        err = str(e).lower()
        if (
            "not found" in err
            or "registration-token-not-registered" in err
            or "unregistered" in err
            or "requested entity was not found" in err
        ):
            raise InvalidPushToken(str(e)) from e
        logger.warning("FCM send failed: %s", e)
        return False


def send_native_for_platform(
    platform: str,
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    pl = (platform or "expo").lower()
    if pl == "ios":
        return send_apns(token, title, body, data)
    if pl == "android":
        return send_fcm(token, title, body, data)
    logger.warning(
        "send_native_for_platform called with unexpected platform: %s", platform
    )
    return False
