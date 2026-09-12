"""Shared-secret guard for server-to-server backend routes.

The backend has two faces:

* **Browser-facing** routes the web app calls directly from the client
  (``/api/phonemes/reference/{word}``, ``/api/phonemes/tts``). These are per-word
  lookups with long-lived cache headers and no third-party spend beyond one TTS
  call for text the caller already has to know.
* **Server-to-server** routes only the Next.js app should ever reach -- script
  generation, which spends OpenRouter credit and can be looped. Before this
  guard, ``curl -X POST http://backend/api/practice/script`` was free LLM
  inference for anyone who found the URL.

Set ``INTERNAL_API_TOKEN`` on both sides and the second group requires a matching
``X-Internal-Token`` header. Left unset, the guard allows the call but warns
loudly at startup: a missing secret must not break a local checkout, but it also
must not be able to pass for security in production.
"""

from __future__ import annotations

import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

INTERNAL_TOKEN_HEADER = "X-Internal-Token"


async def require_internal_caller(
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> None:
    """Allow only callers holding the shared secret, when one is configured."""
    expected = (settings.INTERNAL_API_TOKEN or "").strip()
    if not expected:
        return
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This endpoint is internal to the TalkFlow web app.",
        )
