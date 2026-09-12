"""The voice socket's token has to be unforgeable and short-lived.

Before this existed, ``/ws/voice`` accepted anonymous connections. That is not
a theoretical hole: every turn runs two CPU models and spends OpenRouter and
Google TTS credit, and the ``session_id`` the client sent was used as the
folder name for persisted turn audio. The signature is the only thing standing
between a public URL and an open tab on someone's API budget, so the failure
modes are tested individually rather than as "valid token works".
"""

import base64
import json
import time
import unittest

from app.core.ws_auth import (
    TOKEN_VERSION,
    WSTokenError,
    mint_token,
    verify_token,
)

SECRET = "unit-test-secret"


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class RoundTripTests(unittest.TestCase):
    def test_a_minted_token_verifies(self):
        token = mint_token("user-1", "session-1", secret=SECRET)
        claims = verify_token(token, secret=SECRET)
        self.assertEqual(claims.user_id, "user-1")
        self.assertEqual(claims.session_id, "session-1")

    def test_the_client_side_can_reproduce_the_signature(self):
        """The Node.js verifier is three lines; pin the exact bytes it signs.

        The web app signs the base64url payload string with HMAC-SHA256 and
        hex-encodes it. If this encoding ever changes, the web app mints tokens
        the backend silently rejects -- a failure that only shows up as a dead
        microphone in production.
        """
        import hashlib
        import hmac

        token = mint_token("user-1", "session-1", secret=SECRET, ttl_seconds=60)
        payload_b64, signature = token.split(".")

        expected = hmac.new(
            SECRET.encode(), payload_b64.encode("ascii"), hashlib.sha256
        ).hexdigest()
        self.assertEqual(signature, expected)

        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        self.assertEqual(payload["v"], TOKEN_VERSION)
        self.assertEqual(payload["sub"], "user-1")
        self.assertEqual(payload["sid"], "session-1")


class RejectionTests(unittest.TestCase):
    def test_an_empty_secret_never_mints(self):
        with self.assertRaises(WSTokenError):
            mint_token("u", "s", secret="")

    def test_a_missing_secret_never_verifies(self):
        token = mint_token("u", "s", secret=SECRET)
        with self.assertRaises(WSTokenError):
            verify_token(token, secret="")

    def test_missing_and_malformed_tokens_are_rejected(self):
        for token in (None, "", "no-dot-here", ".", "payload."):
            with self.subTest(token=token):
                with self.assertRaises(WSTokenError):
                    verify_token(token, secret=SECRET)

    def test_a_tampered_payload_is_rejected(self):
        """The attack that matters: swap the session id, keep the signature."""
        token = mint_token("user-1", "mine", secret=SECRET)
        _, signature = token.split(".")
        forged_payload = b64url(
            json.dumps(
                {"v": 1, "sub": "user-1", "sid": "someone-elses", "exp": 2**31},
                separators=(",", ":"),
                sort_keys=True,
            ).encode()
        )
        with self.assertRaises(WSTokenError):
            verify_token(f"{forged_payload}.{signature}", secret=SECRET)

    def test_a_token_signed_with_another_secret_is_rejected(self):
        token = mint_token("u", "s", secret="some-other-secret")
        with self.assertRaises(WSTokenError):
            verify_token(token, secret=SECRET)

    def test_an_expired_token_is_rejected(self):
        token = mint_token("u", "s", secret=SECRET, ttl_seconds=60, now=1000.0)
        with self.assertRaises(WSTokenError):
            verify_token(token, secret=SECRET, now=1000.0 + 61)

    def test_a_token_is_valid_up_to_its_expiry(self):
        token = mint_token("u", "s", secret=SECRET, ttl_seconds=60, now=1000.0)
        claims = verify_token(token, secret=SECRET, now=1000.0 + 59)
        self.assertEqual(claims.session_id, "s")

    def test_an_unknown_version_is_rejected(self):
        # A future token shape must not be accepted by an old server.
        payload = b64url(
            json.dumps(
                {"v": 99, "sub": "u", "sid": "s", "exp": int(time.time()) + 60},
                separators=(",", ":"),
                sort_keys=True,
            ).encode()
        )
        import hashlib
        import hmac

        signature = hmac.new(
            SECRET.encode(), payload.encode("ascii"), hashlib.sha256
        ).hexdigest()
        with self.assertRaises(WSTokenError):
            verify_token(f"{payload}.{signature}", secret=SECRET)

    def test_a_payload_without_subject_or_session_is_rejected(self):
        import hashlib
        import hmac

        payload = b64url(json.dumps({"v": 1, "exp": 2**31}).encode())
        signature = hmac.new(
            SECRET.encode(), payload.encode("ascii"), hashlib.sha256
        ).hexdigest()
        with self.assertRaises(WSTokenError):
            verify_token(f"{payload}.{signature}", secret=SECRET)


if __name__ == "__main__":
    unittest.main()
