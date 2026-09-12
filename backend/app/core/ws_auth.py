"""Short-lived authentication tokens for the voice WebSocket.

Why this exists
---------------
The browser authenticates to Next.js with a Better Auth session cookie. It
cannot hand that cookie to this FastAPI service (different origin, and a
WebSocket handshake from ``new WebSocket(url)`` can't attach custom headers).
Before this module existed, ``/ws/voice`` therefore accepted *any* socket:
an anonymous client could burn OpenRouter and Google TTS credit, and the
``session_id`` it sent in ``SESSION_CONFIG`` was trusted as an audio
filesystem path.

How it works
------------
``POST /api/sessions/[id]/ws-token`` in the web app (cookie-authenticated)
mints::

    <base64url(json payload)>.<hex hmac-sha256(secret, base64url payload)>

with payload ``{"v": 1, "sub": <userId>, "sid": <practiceSessionId>, "exp": <unix>}``.
The client appends it to the WebSocket URL and the server verifies it here,
then checks that the ``sid`` in the token matches the ``session_id`` the client
later claims in ``SESSION_CONFIG``.

The signature is plain HMAC over the base64url payload so the Node.js side is
three lines (``crypto.createHmac("sha256", secret).update(payload).digest("hex")``)
and cannot drift from this implementation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

TOKEN_VERSION = 1


class WSTokenError(Exception):
    """Raised when a token is malformed, mis-signed, or expired."""


@dataclass(frozen=True)
class WSClaims:
    """What a verified token asserts."""

    user_id: str
    session_id: str
    exp: int


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(payload_b64: str, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).hexdigest()


def mint_token(
    user_id: str,
    session_id: str,
    *,
    secret: Optional[str] = None,
    ttl_seconds: Optional[int] = None,
    now: Optional[float] = None,
) -> str:
    """Mint a token. Used by the web app's route handler and by the smoke scripts."""
    secret = secret if secret is not None else settings.WS_TOKEN_SECRET
    if not secret:
        raise WSTokenError("WS_TOKEN_SECRET is not configured")
    ttl = settings.WS_TOKEN_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    issued = time.time() if now is None else now
    payload = {
        "v": TOKEN_VERSION,
        "sub": user_id,
        "sid": session_id,
        "exp": int(issued) + int(ttl),
    }
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    return f"{payload_b64}.{_sign(payload_b64, secret)}"


def verify_token(
    token: Optional[str],
    *,
    secret: Optional[str] = None,
    now: Optional[float] = None,
) -> WSClaims:
    """Verify signature + expiry. Raises ``WSTokenError`` on any problem.

    Every failure mode is a rejection, never a warning-and-continue.
    """
    secret = secret if secret is not None else settings.WS_TOKEN_SECRET
    if not secret:
        raise WSTokenError("WS_TOKEN_SECRET is not configured")
    if not token or "." not in token:
        raise WSTokenError("missing or malformed token")

    payload_b64, _, signature = token.partition(".")
    if not payload_b64 or not signature:
        raise WSTokenError("missing or malformed token")

    expected = _sign(payload_b64, secret)
    if not hmac.compare_digest(expected, signature):
        raise WSTokenError("bad signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception as exc:  # malformed base64 or JSON
        raise WSTokenError("undecodable payload") from exc

    if payload.get("v") != TOKEN_VERSION:
        raise WSTokenError(f"unsupported token version {payload.get('v')!r}")

    subject = str(payload.get("sub") or "")
    session_id = str(payload.get("sid") or "")
    if not subject or not session_id:
        raise WSTokenError("token is missing sub/sid")

    current = time.time() if now is None else now
    try:
        exp = int(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:
        raise WSTokenError("token is missing exp") from exc
    if exp <= current:
        raise WSTokenError("token expired")

    return WSClaims(user_id=subject, session_id=session_id, exp=exp)


def token_or_none(token: Optional[str]) -> Optional[WSClaims]:
    """Verify for logging-friendly callers: ``None`` instead of raising."""
    try:
        return verify_token(token)
    except WSTokenError as exc:
        logger.info("WebSocket token rejected: %s", exc)
        return None
