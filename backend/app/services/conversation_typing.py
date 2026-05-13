"""Ephemeral per-match typing indicators (in-process). TTL refreshed by client heartbeats."""

from __future__ import annotations

import threading
import time

_typing_lock = threading.Lock()
# match_id -> { auth_user_id: monotonic_deadline }
_match_typing: dict[int, dict[int, float]] = {}

TYPING_TTL_SEC = 5.0


def set_typing(match_id: int, user_id: int, active: bool) -> None:
    with _typing_lock:
        if active:
            bucket = _match_typing.setdefault(match_id, {})
            bucket[user_id] = time.monotonic() + TYPING_TTL_SEC
        else:
            bucket = _match_typing.get(match_id)
            if not bucket:
                return
            bucket.pop(user_id, None)
            if not bucket:
                _match_typing.pop(match_id, None)


def active_typer_ids(match_id: int, exclude_user_id: int | None = None) -> list[int]:
    now = time.monotonic()
    with _typing_lock:
        bucket = _match_typing.get(match_id)
        if not bucket:
            return []
        dead = [uid for uid, until in bucket.items() if until < now]
        for uid in dead:
            del bucket[uid]
        if not bucket:
            _match_typing.pop(match_id, None)
            return []
        out = [uid for uid in bucket if uid != exclude_user_id]
        return out
