"""Difficulty bands, step validation, and the offline fallback bank.

What used to live here -- five hardcoded topic banks (``DAILY_SENTENCES``,
``INTERVIEW_SENTENCES``, ...) selected by substring-matching the coach name --
is gone. Practice content now arrives from one of two places:

  * ``script_generator`` -- LLM generation from the coach's topic + difficulty
  * ``text_segmenter``   -- the user's own pasted text, split into steps

This module is the single source of truth for what a difficulty tier *means*.
Both generators validate against it, the WebSocket session takes its pass
threshold from it, and the UI renders its labels. That makes "difficulty" an
enforced property of the content rather than a word in a prompt.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple

from app.services.pronunciation.phone_set import VOWELS
from app.utils.text import split_display_words, tokenize_words

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DifficultyBand:
    """The measurable definition of one difficulty tier."""

    name: str
    label: str
    min_words: int
    max_words: int
    #: Hard cap -- a step containing any word longer than this is rejected.
    max_syllables_per_word: int
    #: Minimum number of words with >= 3 syllables. Forces real lexical load
    #: at the harder tiers instead of just longer strings of short words.
    min_multisyllabic: int
    #: Score (0-100) a turn must reach to advance to the next step.
    pass_threshold: float
    description: str

    @property
    def target_words(self) -> int:
        return (self.min_words + self.max_words) // 2


DIFFICULTY_BANDS: Dict[str, DifficultyBand] = {
    "easy": DifficultyBand(
        name="easy",
        label="Easy",
        min_words=4,
        max_words=7,
        max_syllables_per_word=2,
        min_multisyllabic=0,
        pass_threshold=80.0,
        description="4-7 words, short everyday vocabulary, pass at 80%",
    ),
    "medium": DifficultyBand(
        name="medium",
        label="Medium",
        min_words=7,
        max_words=12,
        max_syllables_per_word=5,
        min_multisyllabic=1,
        pass_threshold=88.0,
        description="7-12 words, some longer words and consonant clusters, pass at 88%",
    ),
    "hard": DifficultyBand(
        name="hard",
        label="Hard",
        min_words=12,
        max_words=20,
        max_syllables_per_word=8,
        min_multisyllabic=3,
        pass_threshold=93.0,
        description="12-20 words, dense multi-syllable vocabulary, pass at 93%",
    ),
}

DEFAULT_DIFFICULTY = "medium"


def get_band(difficulty: str) -> DifficultyBand:
    """Return the band for *difficulty*, falling back to medium."""
    return DIFFICULTY_BANDS.get((difficulty or "").strip().lower(), DIFFICULTY_BANDS[DEFAULT_DIFFICULTY])


def pass_threshold_for(difficulty: str) -> float:
    return get_band(difficulty).pass_threshold


# ---------------------------------------------------------------------------
# Syllable counting
# ---------------------------------------------------------------------------

_VOWEL_GROUP_RE = re.compile(r"[aeiouy]+")


def _heuristic_syllables(word: str) -> int:
    """Vowel-group count -- only used when CMUDict/g2p is unavailable."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 1
    groups = _VOWEL_GROUP_RE.findall(w)
    count = len(groups)
    # Silent trailing "e" ("make" is one syllable, not two).
    if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and count > 1:
        count -= 1
    return max(1, count)


def syllable_count(word: str) -> int:
    """Syllables in *word*, via CMUDict/g2p_en with a heuristic fallback.

    Counted as **vowel nuclei in the ARPAbet phoneme string**, which is the
    definition of a syllable. ``entry.syllables`` is deliberately not used here:
    it is the *display* respelling produced by ``_allocate_phonemes``, which
    merges nuclei when it cannot map them onto the spelling ("banana" comes back
    as ``buh-nanuh``, two syllables for a three-syllable word). Undercounting
    there would let a three-syllable word past the easy tier's two-syllable cap.

    ``PronunciationService`` is imported lazily: it loads a 126k-entry
    dictionary at construction, and this module is imported by the WebSocket
    route at startup.
    """
    cleaned = re.sub(r"[^A-Za-z']", "", word or "")
    if not cleaned:
        return 1
    try:
        from app.services.pronunciation_service import pronunciation_service

        entry = pronunciation_service.lookup(cleaned.lower())
        nuclei = sum(1 for p in entry.phonemes if p.symbol in VOWELS)
        if nuclei:
            return nuclei
        if entry.syllables:
            return len(entry.syllables)
    except Exception:
        logger.debug("Syllable lookup failed for %r; using heuristic", cleaned, exc_info=True)
    return _heuristic_syllables(cleaned)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_step(text: str, difficulty: str) -> Tuple[bool, str]:
    """Check one practice step against its difficulty band.

    Returns ``(ok, reason)``. ``reason`` is empty when ok, otherwise a short
    human-readable explanation used for logging and regeneration prompts.
    """
    band = get_band(difficulty)
    words = tokenize_words(text)
    if not words:
        return False, "no words"

    n = len(words)
    if n < band.min_words:
        return False, f"too short ({n} words, need >= {band.min_words})"
    if n > band.max_words:
        return False, f"too long ({n} words, need <= {band.max_words})"

    multisyllabic = 0
    for word in words:
        syl = syllable_count(word)
        if syl > band.max_syllables_per_word:
            return False, f"word {word!r} has {syl} syllables (max {band.max_syllables_per_word})"
        if syl >= 3:
            multisyllabic += 1

    if multisyllabic < band.min_multisyllabic:
        return False, (
            f"only {multisyllabic} multi-syllable word(s), "
            f"need >= {band.min_multisyllabic}"
        )

    return True, ""


# ---------------------------------------------------------------------------
# Offline fallback bank
# ---------------------------------------------------------------------------
#
# Used only when the LLM is unavailable (no OPENROUTER_API_KEY, network
# failure, malformed output). Scripts built from these are tagged
# ``generated_by="fallback"`` so the UI can say so rather than pretending the
# content was generated for the user's topic. Every entry is asserted against
# its own tier's band by tests/test_practice_content.py.

FALLBACK_BANK: Dict[str, List[str]] = {
    "easy": [
        "I want to speak clearly.",
        "Can you say that again?",
        "Let me try this one.",
        "I practice out loud daily.",
        "Please speak a bit slower.",
        "That sounds like a plan.",
        "I need a little help.",
        "We can start right now.",
        "This word is quite hard.",
        "I am ready to begin.",
        "Tell me what you think.",
        "My voice is getting stronger.",
        "Let us try that phrase.",
        "I will read it aloud.",
        "Thank you for your time.",
    ],
    "medium": [
        "I would like to improve my pronunciation this month.",
        "Speaking clearly takes patience and consistent daily practice.",
        "Could you explain that idea in simpler words?",
        "My confidence grows every time I practice out loud.",
        "The weather changed completely throughout the entire afternoon.",
        "I enjoy working with people from different countries.",
        "Please repeat the question so I understand it properly.",
        "Regular practice creates visible progress within a few weeks.",
        "I handled the situation by staying calm and listening.",
        "This exercise helps me pronounce difficult consonant clusters.",
        "Learning a language requires curiosity, patience, and repetition.",
        "I want to sound natural during ordinary conversations.",
        "Reading aloud every morning improved my rhythm considerably.",
        "She explained the entire procedure in under three minutes.",
        "Good communication depends on clarity rather than speed.",
    ],
    "hard": [
        "Consistent pronunciation practice gradually transforms hesitant speech into genuinely confident and natural conversation.",
        "The organization prioritized transparency, accountability, and measurable improvement across every single department.",
        "Understanding unfamiliar vocabulary requires deliberate repetition alongside a genuine curiosity about meaning.",
        "Technological innovation continually reshapes the way professionals communicate across large international organizations.",
        "Articulating complicated arguments demands precision, careful preparation, and a considerable amount of discipline.",
        "Environmental researchers documented significant variations throughout the extended observation period last summer.",
        "Successful negotiation typically involves patience, empathy, and remarkably careful listening from everyone involved.",
        "Distinguishing similar consonant clusters represents a persistent difficulty for most intermediate language learners.",
        "Academic presentations reward clarity, evidence, and unmistakably confident delivery above elaborate vocabulary.",
        "Contemporary journalism balances immediacy against accuracy, occasionally sacrificing valuable context along the way.",
        "Developing professional fluency involves rehearsing unfamiliar terminology until the pronunciation becomes completely automatic.",
        "Collaborative teams communicate their expectations explicitly, preventing unnecessary confusion and expensive duplicated effort.",
        "Interpreting statistical evidence responsibly requires understanding the methodology, its limitations, and any potential bias.",
        "Persuasive communication combines memorable structure, deliberate emphasis, and genuinely authentic personal enthusiasm.",
        "International conferences encourage participants to articulate unfamiliar concepts with remarkable precision and confidence.",
    ],
}


def fallback_steps(difficulty: str, step_count: int, exclude: List[str] | None = None) -> List[str]:
    """Return up to *step_count* fallback sentences for a tier, cycling if needed."""
    bank = FALLBACK_BANK.get(get_band(difficulty).name, FALLBACK_BANK[DEFAULT_DIFFICULTY])
    seen = {s.strip().lower() for s in (exclude or [])}
    picked: List[str] = []
    for sentence in bank:
        if len(picked) >= step_count:
            break
        if sentence.strip().lower() not in seen:
            picked.append(sentence)
            seen.add(sentence.strip().lower())
    # If the caller wants more steps than the bank holds, repeat it -- practising
    # a sentence twice is better than handing back a short script.
    i = 0
    while len(picked) < step_count and bank:
        picked.append(bank[i % len(bank)])
        i += 1
    return picked


def split_practice_words(sentence: str) -> List[str]:
    """Split a practice sentence into the word chips shown during a turn."""
    words = split_display_words(sentence)
    if words:
        return words
    stripped = (sentence or "").strip()
    return [stripped] if stripped else []
