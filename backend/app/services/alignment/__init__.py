"""Alignment providers package.

Exports the AlignmentProvider abstract base class.
Import specific providers directly from their modules.

Current providers
-----------------
  whisperx_provider.WhisperXAlignmentProvider   — Phase 2 (initial)

Planned providers
-----------------
  mfa_provider.MontrealForcedAlignerProvider     — Phase 3+
"""

from app.services.alignment.base import AlignmentProvider

__all__ = ["AlignmentProvider"]
