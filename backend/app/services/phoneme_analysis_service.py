"""Phoneme analysis service.

Converts text to IPA phonemes via g2p-en and compares an expected sequence
against a user-produced sequence using longest-common-subsequence alignment
(via difflib.SequenceMatcher), producing per-phoneme feedback suitable for
pronunciation coaching.

Audio-based phoneme extraction is intentionally not implemented here; the
caller is expected to provide the user's transcript text (e.g. from Wav2Vec2)
as the "actual" pronunciation input.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_STRESS_RE = re.compile(r"\d+$")

IPA_FEEDBACK_MAP: Dict[str, Dict[str, str]] = {
    "θ": {"description": "voiceless 'th' as in 'think'", "tip": "Place tongue lightly between teeth and blow air without voicing."},
    "ð": {"description": "voiced 'th' as in 'this'", "tip": "Place tongue between teeth and voice the sound."},
    "ŋ": {"description": "'ng' as in 'sing'", "tip": "Raise the back of the tongue to the soft palate."},
    "ʃ": {"description": "'sh' as in 'ship'", "tip": "Round lips and push air across the roof of the mouth."},
    "ʒ": {"description": "'zh' as in 'measure'", "tip": "Round lips and voice the sound."},
    "tʃ": {"description": "'ch' as in 'cheese'", "tip": "Touch the palate with the tongue tip, then release with a puff of air."},
    "dʒ": {"description": "'j' as in 'judge'", "tip": "Touch the palate with the tongue tip, voice it, then release."},
    "r": {"description": "'r' as in 'red'", "tip": "Curl the tongue tip slightly back without touching the palate."},
    "l": {"description": "'l' as in 'light'", "tip": "Touch the alveolar ridge (behind upper teeth) with the tongue tip."},
    "æ": {"description": "'a' as in 'cat'", "tip": "Open the jaw and keep the tongue flat and forward."},
    "ɪ": {"description": "'i' as in 'bit'", "tip": "Relaxed front-middle tongue position."},
    "ɛ": {"description": "'e' as in 'bed'", "tip": "Mid-front tongue position."},
    "ʌ": {"description": "'u' as in 'strut'", "tip": "Central tongue position with relaxed lips."},
    "ɑ": {"description": "'a' as in 'father'", "tip": "Open the jaw wide, tongue low and back."},
}

CONFUSION_TIPS: Dict[Tuple[str, str], str] = {
    ("θ", "s"): "You're making an 's' instead of 'th'. Place your tongue between your teeth.",
    ("ð", "d"): "You're making a 'd' instead of voiced 'th'. Relax the tongue between the teeth.",
    ("r", "l"): "You're making an 'l' instead of 'r'. Curl the tongue back without touching the palate.",
    ("ŋ", "n"): "You're making an 'n' instead of 'ng'. Raise the back of the tongue.",
    ("v", "w"): "You're making a 'w' instead of 'v'. Touch the lower lip to the upper teeth.",
    ("ʃ", "s"): "You're making an 's' instead of 'sh'. Round your lips and pull the tongue back.",
}


@dataclass
class PhonemeSegment:
    phoneme: str
    expected: str
    actual: str
    accuracy: float
    is_correct: bool
    feedback: Optional[str] = None
    suggestions: Optional[List[str]] = None


@dataclass
class WordPhonemeAnalysis:
    word: str
    expected_ipa: str
    expected_phonemes: List[str]
    actual_phonemes: List[str]
    segments: List[PhonemeSegment]
    word_accuracy: float
    phoneme_matches: int
    total_phonemes: int
    suggestions: List[str] = field(default_factory=list)


@dataclass
class SentencePhonemeAnalysis:
    sentence: str
    words: List[WordPhonemeAnalysis]
    overall_accuracy: float
    problematic_phonemes: List[str]
    mastered_phonemes: List[str]
    most_common_errors: List[Tuple[str, int]]


def _normalize_phoneme(token: str) -> str:
    """Strip ARPAbet stress digits (e.g. 'AH0' -> 'AH')."""
    return _STRESS_RE.sub("", token).strip()


from app.utils.text import tokenize_words as _tokenize_words


class PhonemeAnalyzer:
    """Thread-safe phoneme analyzer with lazy g2p loading."""

    def __init__(self) -> None:
        self._g2p = None
        self._g2p_lock = Lock()

    def _get_g2p(self):
        if self._g2p is None:
            with self._g2p_lock:
                if self._g2p is None:
                    self._ensure_nltk_resources()
                    from g2p_en import G2p

                    logger.info("Loading g2p-en model")
                    self._g2p = G2p()
        return self._g2p

    @staticmethod
    def _ensure_nltk_resources() -> None:
        """g2p-en depends on NLTK corpora that ship separately; download on demand."""
        import nltk

        required = [
            ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
            ("taggers/averaged_perceptron_tagger", "averaged_perceptron_tagger"),
            ("corpora/cmudict", "cmudict"),
        ]
        for path, pkg in required:
            try:
                nltk.data.find(path)
            except LookupError:
                logger.info("Downloading NLTK resource %s", pkg)
                try:
                    nltk.download(pkg, quiet=True)
                except Exception:
                    logger.exception("Failed to download NLTK resource %s", pkg)

    def _phonemes_for_word(self, word: str) -> List[str]:
        if not word:
            return []
        try:
            tokens = self._get_g2p()(word)
        except Exception:
            logger.exception("g2p failed for word %r", word)
            return []
        return [_normalize_phoneme(t) for t in tokens if t and t.strip() and t.strip().isalnum()]

    def raw_arpabet_tokens_for_word(self, word: str) -> List[str]:
        if not word:
            return []
        try:
            tokens = self._get_g2p()(word)
        except Exception:
            logger.exception("g2p failed for word %r", word)
            return []
        out: List[str] = []
        for t in tokens:
            if t is None:
                continue
            s = str(t).strip()
            if not s or not s[0].isalnum():
                continue
            out.append(s)
        return out

    def text_to_ipa(self, text: str) -> Dict[str, List[str]]:
        """Convert text to a mapping of word -> phoneme list."""
        result: Dict[str, List[str]] = {}
        for word in _tokenize_words(text):
            if word in result:
                continue
            result[word] = self._phonemes_for_word(word)
        return result

    def calculate_phoneme_similarity(
        self,
        expected_phonemes: List[str],
        actual_phonemes: List[str],
    ) -> Tuple[float, List[PhonemeSegment]]:
        """Align expected vs actual phonemes and score the match."""
        if not expected_phonemes and not actual_phonemes:
            return 100.0, []
        if not expected_phonemes:
            return 0.0, []

        matcher = SequenceMatcher(None, expected_phonemes, actual_phonemes, autojunk=False)
        matched_expected = set()
        actual_by_expected_idx: Dict[int, str] = {}

        for block in matcher.get_matching_blocks():
            for offset in range(block.size):
                matched_expected.add(block.a + offset)
                actual_by_expected_idx[block.a + offset] = actual_phonemes[block.b + offset]

        segments: List[PhonemeSegment] = []
        for i, expected in enumerate(expected_phonemes):
            is_correct = i in matched_expected
            actual = actual_by_expected_idx.get(i, actual_phonemes[i] if i < len(actual_phonemes) else "")
            segments.append(
                PhonemeSegment(
                    phoneme=expected,
                    expected=expected,
                    actual=actual,
                    accuracy=100.0 if is_correct else 0.0,
                    is_correct=is_correct,
                    feedback=None if is_correct else self._phoneme_feedback(expected),
                    suggestions=None if is_correct else self._phoneme_suggestions(expected, actual),
                )
            )

        accuracy = (len(matched_expected) / len(expected_phonemes)) * 100.0
        return accuracy, segments

    def _phoneme_feedback(self, phoneme: str) -> Optional[str]:
        entry = IPA_FEEDBACK_MAP.get(phoneme)
        return entry["description"] if entry else None

    def _phoneme_suggestions(self, expected: str, actual: str) -> Optional[List[str]]:
        suggestions: List[str] = []
        entry = IPA_FEEDBACK_MAP.get(expected)
        if entry:
            suggestions.append(entry["tip"])
        if actual and actual != expected:
            tip = CONFUSION_TIPS.get((expected, actual))
            if tip:
                suggestions.append(tip)
        return suggestions or None

    async def analyze_word(
        self,
        word: str,
        user_transcript: Optional[str] = None,
    ) -> Optional[WordPhonemeAnalysis]:
        clean_word = (word or "").strip().lower()
        if not clean_word:
            return None

        expected_phonemes = self._phonemes_for_word(clean_word)
        if not expected_phonemes:
            logger.debug("No phonemes produced for word %r", clean_word)
            return WordPhonemeAnalysis(
                word=clean_word,
                expected_ipa="",
                expected_phonemes=[],
                actual_phonemes=[],
                segments=[],
                word_accuracy=0.0,
                phoneme_matches=0,
                total_phonemes=0,
                suggestions=[],
            )

        if user_transcript:
            user_tokens = _tokenize_words(user_transcript)
            actual_phonemes: List[str] = []
            for token in user_tokens:
                actual_phonemes.extend(self._phonemes_for_word(token))
        else:
            actual_phonemes = list(expected_phonemes)

        accuracy, segments = self.calculate_phoneme_similarity(expected_phonemes, actual_phonemes)
        matches = sum(1 for seg in segments if seg.is_correct)

        suggestions: List[str] = []
        seen: set = set()
        for seg in segments:
            if not seg.suggestions:
                continue
            for tip in seg.suggestions:
                if tip not in seen:
                    seen.add(tip)
                    suggestions.append(tip)

        return WordPhonemeAnalysis(
            word=clean_word,
            expected_ipa="".join(expected_phonemes),
            expected_phonemes=expected_phonemes,
            actual_phonemes=actual_phonemes,
            segments=segments,
            word_accuracy=accuracy,
            phoneme_matches=matches,
            total_phonemes=len(expected_phonemes),
            suggestions=suggestions,
        )

    async def analyze_sentence(
        self,
        sentence: str,
        user_transcript: Optional[str] = None,
    ) -> Optional[SentencePhonemeAnalysis]:
        if not sentence or not sentence.strip():
            return None

        expected_words = _tokenize_words(sentence)
        actual_words = _tokenize_words(user_transcript) if user_transcript else []

        word_analyses: List[WordPhonemeAnalysis] = []
        for idx, expected_word in enumerate(expected_words):
            user_word = actual_words[idx] if idx < len(actual_words) else None
            analysis = await self.analyze_word(expected_word, user_word)
            if analysis is not None:
                word_analyses.append(analysis)

        if word_analyses:
            total_expected = sum(w.total_phonemes for w in word_analyses)
            total_matches = sum(w.phoneme_matches for w in word_analyses)
            overall_accuracy = (total_matches / total_expected) * 100.0 if total_expected else 0.0
        else:
            overall_accuracy = 0.0

        problematic: List[str] = []
        mastered: List[str] = []
        error_counts: Dict[str, int] = {}
        problematic_seen: set = set()
        mastered_seen: set = set()

        for word_analysis in word_analyses:
            for segment in word_analysis.segments:
                if segment.is_correct:
                    if segment.phoneme not in mastered_seen:
                        mastered_seen.add(segment.phoneme)
                        mastered.append(segment.phoneme)
                else:
                    if segment.phoneme not in problematic_seen:
                        problematic_seen.add(segment.phoneme)
                        problematic.append(segment.phoneme)
                    error_counts[segment.phoneme] = error_counts.get(segment.phoneme, 0) + 1

        most_common_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]

        return SentencePhonemeAnalysis(
            sentence=sentence,
            words=word_analyses,
            overall_accuracy=overall_accuracy,
            problematic_phonemes=problematic,
            mastered_phonemes=mastered,
            most_common_errors=most_common_errors,
        )

    def phonemes_for_text_flat(self, text: str) -> List[str]:
        if not (text or "").strip():
            return []
        out: List[str] = []
        for w in _tokenize_words(text):
            out.extend(self._phonemes_for_word(w))
        return out


def phoneme_opcodes(
    expected_phonemes: List[str],
    actual_phonemes: List[str],
) -> List[Dict[str, Any]]:
    if not expected_phonemes and not actual_phonemes:
        return []
    matcher = SequenceMatcher(
        None, expected_phonemes, actual_phonemes, autojunk=False
    )
    out: List[Dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        e_seg = " ".join(expected_phonemes[i1:i2]) if i1 < i2 else ""
        a_seg = " ".join(actual_phonemes[j1:j2]) if j1 < j2 else ""
        if tag == "equal":
            out.append(
                {
                    "op": "equal",
                    "expected": e_seg,
                    "actual": a_seg,
                }
            )
        elif tag == "replace":
            out.append(
                {
                    "op": "replace",
                    "expected": e_seg,
                    "actual": a_seg,
                }
            )
        elif tag == "delete":
            out.append(
                {
                    "op": "delete",
                    "expected": e_seg,
                    "actual": a_seg,
                }
            )
        else:  # insert
            out.append(
                {
                    "op": "insert",
                    "expected": e_seg,
                    "actual": a_seg,
                }
            )
    return out


def phoneme_pronunciation_score(
    expected_phonemes: List[str], actual_phonemes: List[str]
) -> float:
    if not expected_phonemes and not actual_phonemes:
        return 100.0
    if not expected_phonemes:
        return 0.0
    matcher = SequenceMatcher(
        None, expected_phonemes, actual_phonemes, autojunk=False
    )
    return round(matcher.ratio() * 100.0, 2)


def build_pronunciation_result_dict(
    analyzer: PhonemeAnalyzer,
    target_for_turn: str,
    heard_text: str,
) -> Dict[str, Any]:
    from app.services.pronunciation_feedback import generate_feedback

    target_for_turn = (target_for_turn or "").strip()
    heard_text = (heard_text or "").strip()
    if not target_for_turn:
        return {
            "expected_phonemes": [],
            "actual_phonemes": [],
            "errors": [],
            "score": 0.0,
            "feedback": ["No target phrase to compare against."],
        }
    if not heard_text:
        exp = analyzer.phonemes_for_text_flat(target_for_turn)
        opcodes = phoneme_opcodes(exp, [])
        return {
            "expected_phonemes": exp,
            "actual_phonemes": [],
            "errors": opcodes,
            "score": 0.0,
            "feedback": generate_feedback([o for o in opcodes if o.get("op") != "equal"])
            or ["No speech recognized for that phrase."],
        }
    exp = analyzer.phonemes_for_text_flat(target_for_turn)
    act = analyzer.phonemes_for_text_flat(heard_text)
    opcodes = phoneme_opcodes(exp, act)
    score = phoneme_pronunciation_score(exp, act)
    feedback = generate_feedback(
        [o for o in opcodes if o.get("op") != "equal"]
    )
    return {
        "expected_phonemes": exp,
        "actual_phonemes": act,
        "errors": opcodes,
        "score": score,
        "feedback": feedback,
    }


phoneme_analyzer = PhonemeAnalyzer()
