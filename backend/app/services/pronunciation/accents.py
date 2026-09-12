"""Accent profiles: what counts as *correct* depends on the accent being learned.

The reference pronunciation behind scoring is CMUDict, i.e. General American.
That was never a problem for an en-US target, but a coach set to en-GB was still
being scored against a rhotic American reference: a British learner who correctly
drops the /r/ in "party" was charged for a missing sound. ``TARGET_ACCENT`` and
the coach's ``accent`` reached script generation and TTS and stopped there.

A profile is a property of the *accent*, never of the learner's ability, and it
does exactly two things:

1. :meth:`AccentProfile.normalize_reference` rewrites the CMUDict reference into
   the accent's own inventory -- non-rhotic accents drop /r/ before a consonant
   or a pause, exactly where RP and Australian English drop it.
2. :meth:`AccentProfile.apply` rewrites aligned pairs that the accent *requires*
   into matches, so accent-defining variation in the vowel space is not scored
   as a mispronunciation.

Deliberately **not** in here: substitutions that harm intelligibility even when
they are typical of a particular L1 -- θ→t, ð→d, v→w, final-consonant deletion.
Those stay errors in every accent. The product is about being understood, not
about sounding American, and a profile must never become a way to score higher
by giving up a distinction a listener needs.

Per-accent *lexical* differences (the BATH/TRAP word list, for instance) are
handled as vowel-space tolerances rather than a second dictionary: shipping and
maintaining four pronunciation dictionaries is a much bigger commitment than the
scoring difference it would buy.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, FrozenSet, List, Optional, Sequence, Tuple

from app.services.pronunciation.alignment import AlignedPair
from app.services.pronunciation.phone_set import VOWELS


@dataclass(frozen=True)
class AccentProfile:
    """One target accent, and the rules that define it for scoring."""

    code: str
    label: str
    #: Google Cloud TTS voice used when this accent is the target.
    tts_voice: str
    #: True when /r/ is pronounced in every position (US, Indian, Irish...).
    rhotic: bool
    #: (expected, actual) phone pairs this accent treats as the same sound.
    tolerated_substitutions: FrozenSet[Tuple[str, str]] = frozenset()
    #: Phones a speaker of this accent may insert without being penalised.
    tolerated_insertions: FrozenSet[str] = frozenset()
    #: Phones a speaker of this accent may leave out without being penalised.
    tolerated_deletions: FrozenSet[str] = frozenset()
    notes: str = ""

    # ------------------------------------------------------------------
    # Reference side
    # ------------------------------------------------------------------
    def normalize_reference(self, phones: Sequence[str]) -> List[str]:
        """Rewrite a CMUDict/General-American reference into this accent.

        Only rhoticity is handled, because it is the one accent rule that can be
        applied to a flat phone list without word boundaries: /r/ survives when
        a vowel follows it ("road", "try", and the linking /r/ in "more apples"),
        and is dropped otherwise ("party", "car", "more tea").
        """
        if self.rhotic:
            return list(phones)

        out: List[str] = []
        for index, phone in enumerate(phones):
            if phone != "R":
                out.append(phone)
                continue
            following = phones[index + 1] if index + 1 < len(phones) else None
            if following in VOWELS:
                out.append(phone)
            # Otherwise it is a non-rhotic coda /r/: dropped, not mispronounced.
        return out

    # ------------------------------------------------------------------
    # Scoring side
    # ------------------------------------------------------------------
    def apply(self, pairs: Sequence[AlignedPair]) -> List[AlignedPair]:
        """Remove accent-defining variation from the alignment before scoring.

        A tolerated substitution becomes an exact match (full credit, no error,
        no feedback tip). A tolerated insertion disappears entirely -- an extra
        phone the accent allows must not inflate the expected-phone denominator.
        """
        out: List[AlignedPair] = []
        for pair in pairs:
            if pair.op == "insert":
                if pair.actual in self.tolerated_insertions:
                    continue
                out.append(pair)
            elif pair.op == "sub":
                if (pair.expected, pair.actual) in self.tolerated_substitutions:
                    out.append(AlignedPair("equal", pair.expected, pair.actual, 0.0))
                else:
                    out.append(pair)
            elif pair.op == "delete":
                if pair.expected in self.tolerated_deletions:
                    out.append(AlignedPair("equal", pair.expected, pair.actual, 0.0))
                else:
                    out.append(pair)
            else:
                out.append(pair)
        return out

    def to_dict(self) -> Dict[str, object]:
        return {
            "code": self.code,
            "label": self.label,
            "tts_voice": self.tts_voice,
            "rhotic": self.rhotic,
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# Vowel-space tolerances
# ---------------------------------------------------------------------------
# Written as explicit pairs rather than a distance rule: these are *accent
# features*, so they should be visible and reviewable line by line, not emerge
# from a threshold.
_TRAP_BATH = frozenset({("AE", "AA"), ("AA", "AE")})
_COT_CAUGHT = frozenset({("AA", "AO"), ("AO", "AA")})
_NO_VOWEL_LENGTH = frozenset({("IH", "IY"), ("IY", "IH"), ("UH", "UW"), ("UW", "UH")})

EN_US = AccentProfile(
    code="en-US",
    label="American English",
    tts_voice="en-US-Neural2-C",
    rhotic=True,
    # CMUDict *is* General American, so the reference needs no rewriting. The
    # cot-caught merger is already covered by the articulatory distance, which
    # is why AA↔AO is not repeated here.
    notes="Reference accent for CMUDict; no reference rewriting.",
)

EN_GB = AccentProfile(
    code="en-GB",
    label="British English",
    tts_voice="en-GB-Neural2-A",
    rhotic=False,
    tolerated_substitutions=_TRAP_BATH | _COT_CAUGHT,
    # "far away" is /fɑːrəˈweɪ/: the linking /r/ is not a wrong extra sound.
    tolerated_insertions=frozenset({"R"}),
    notes="Non-rhotic; trap–bath split.",
)

EN_AU = AccentProfile(
    code="en-AU",
    label="Australian English",
    tts_voice="en-AU-Neural2-A",
    rhotic=False,
    tolerated_substitutions=_TRAP_BATH | _COT_CAUGHT | frozenset({("EH", "EY")}),
    tolerated_insertions=frozenset({"R"}),
    notes="Non-rhotic; raised DRESS vowel (the 'shibboleth' shift).",
)

EN_IN = AccentProfile(
    code="en-IN",
    label="Indian English",
    tts_voice="en-IN-Neural2-A",
    # Indian English is rhotic: /r/ in "car" and "party" is a *target*, not an
    # error, so the US reference is left alone.
    rhotic=True,
    # A smaller vowel inventory: cot/caught, trap/bath and the tense/lax pairs
    # are neutralised. Consonant substitutions typical of Indian English (θ→t,
    # ð→d, v/w) are deliberately absent -- see the module docstring.
    tolerated_substitutions=_COT_CAUGHT | _TRAP_BATH | _NO_VOWEL_LENGTH | frozenset({("AH", "ER")}),
    notes="Rhotic; neutralised vowel length and cot–caught.",
)

#: Canonical profiles, keyed by code. Also the source of the UI's accent picker.
ACCENT_PROFILES: Dict[str, AccentProfile] = {
    profile.code: profile
    for profile in (EN_US, EN_GB, EN_AU, EN_IN)
}

#: Spellings that appear in config, coach rows, and training data.
_ALIASES: Dict[str, str] = {
    "en-us": "en-US",
    "en_us": "en-US",
    "us": "en-US",
    "en-gb": "en-GB",
    "en_gb": "en-GB",
    "gb": "en-GB",
    "uk": "en-GB",
    "en-uk": "en-GB",
    "en-au": "en-AU",
    "en_au": "en-AU",
    "au": "en-AU",
    "en-in": "en-IN",
    "en_india": "en-IN",
    "in": "en-IN",
}

DEFAULT_ACCENT = EN_US.code


def resolve_accent_code(accent: Optional[str]) -> str:
    """Map whatever the caller supplied onto a known profile code."""
    if not accent:
        return DEFAULT_ACCENT
    raw = accent.strip().lower().replace("_", "-")
    if raw in _ALIASES:
        return _ALIASES[raw]
    # Case-insensitive match against canonical codes ("EN-gb" and friends).
    for code in ACCENT_PROFILES:
        if code.lower() == raw:
            return code
    return DEFAULT_ACCENT


def get_accent_profile(accent: Optional[str]) -> AccentProfile:
    """The profile for *accent*, falling back to en-US rather than raising.

    An unknown accent must never break a turn: the session still scores, it just
    scores against the default reference.
    """
    return ACCENT_PROFILES[resolve_accent_code(accent)]


def accent_choices() -> List[Dict[str, object]]:
    """The accent picker's options, in a stable display order."""
    order = [EN_US.code, EN_GB.code, EN_AU.code, EN_IN.code]
    return [ACCENT_PROFILES[code].to_dict() for code in order]
