"""Split a user's own text into practice steps -- deterministically, no LLM.

This is the speech-preparation path: someone pastes the talk they have to give
and practises it line by line. That makes exact word preservation the hard
requirement -- paraphrasing the user's content defeats the entire purpose -- so
this module never generates text, it only decides where to cut.

The invariant, asserted by tests/test_text_segmenter.py:

    tokenize_words(normalize_text(source)) == tokenize_words(" ".join(step.text for step in steps))

Everything works on character offsets of matched word spans, so a token can
never fall between two chunks or be duplicated across them.
"""

from __future__ import annotations

import logging
import math
import re
from typing import List, Tuple

from app.schemas.practice import PracticeScript, PracticeStep
from app.services.practice_content import DifficultyBand, get_band
from app.utils.text import DISPLAY_WORD_RE, tokenize_words

logger = logging.getLogger(__name__)

#: Hard cap on steps. A 40-step session is already ~20 minutes of speaking;
#: beyond that the user should split their material into several sessions.
MAX_STEPS = 40

#: Longest input we will even look at, to keep a pasted book out of the parser.
MAX_SOURCE_CHARS = 20_000

_SMART_CHARS = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "–": "-", "—": "-", "―": "-", "−": "-",
    "…": "...", " ": " ", " ": " ", " ": " ",
}
_SMART_RE = re.compile("|".join(re.escape(k) for k in _SMART_CHARS))

# Words that legitimately end in a period mid-sentence. Compared lowercased
# with trailing dots stripped, so "U.S." matches as "u.s".
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc",
    "e.g", "i.e", "cf", "al", "fig", "approx", "inc", "ltd", "co", "corp",
    "u.s", "u.k", "u.n", "a.m", "p.m", "no", "vol", "dept", "est", "gen",
    "col", "capt", "lt", "sgt", "rev", "hon", "ph.d", "b.a", "m.a", "m.d",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct",
    "nov", "dec", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
}

# A sentence terminator only counts as one when followed by whitespace or EOS,
# which already rules out decimals ("3.14") and most URLs.
_TERMINATOR_RE = re.compile(r"[.!?]+[\"')\]]*(?=\s|$)")
_TRAILING_WORD_RE = re.compile(r"([A-Za-z][A-Za-z.]*)$")

# Preferred places to cut an over-long sentence, in priority order.
_CLAUSE_PUNCT = ",;:-"
_CLAUSE_WORDS = {
    "and", "but", "or", "nor", "so", "yet", "because", "which", "while",
    "although", "though", "however", "therefore", "since", "unless", "whereas",
    "that", "when", "where", "after", "before", "if",
}


def normalize_text(text: str) -> str:
    """Fold smart punctuation to ASCII and tidy whitespace, keeping paragraphs.

    Smart apostrophes matter more than they look: ``WORD_RE`` is ``[a-zA-Z']+``,
    so a curly apostrophe would split "don't" into two tokens and silently break
    the round-trip invariant.
    """
    if not text:
        return ""
    out = _SMART_RE.sub(lambda m: _SMART_CHARS[m.group(0)], text)
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse spaces/tabs but never newlines -- paragraphs are hard breaks.
    out = re.sub(r"[ \t\f\v]+", " ", out)
    out = re.sub(r" *\n *", "\n", out)
    out = re.sub(r"\n{2,}", "\n\n", out)
    return out.strip()


def _split_paragraphs(text: str) -> List[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def _is_real_boundary(text: str, term_start: int) -> bool:
    """Decide whether the terminator at *term_start* actually ends a sentence."""
    m = _TRAILING_WORD_RE.search(text[:term_start + 1].rstrip(".!?\"')]"))
    if not m:
        return True
    word = m.group(1).rstrip(".").lower()
    if word in _ABBREVIATIONS:
        return False
    # Initials: "J. R. R. Tolkien" -- a lone capital letter before a period.
    if len(word) == 1 and text[term_start] == ".":
        return False
    return True


def _split_sentences(paragraph: str) -> List[str]:
    sentences: List[str] = []
    cursor = 0
    for m in _TERMINATOR_RE.finditer(paragraph):
        if not _is_real_boundary(paragraph, m.start()):
            continue
        piece = paragraph[cursor:m.end()].strip()
        if piece:
            sentences.append(piece)
        cursor = m.end()
    tail = paragraph[cursor:].strip()
    if tail:
        sentences.append(tail)
    return sentences or ([paragraph.strip()] if paragraph.strip() else [])


def _word_spans(text: str) -> List[Tuple[int, int]]:
    return [(m.start(), m.end()) for m in DISPLAY_WORD_RE.finditer(text)]


def _break_quality(text: str, spans: List[Tuple[int, int]], idx: int) -> int:
    """Rank a candidate break *before* token *idx*. Higher is better, 0 = none."""
    if idx <= 0 or idx >= len(spans):
        return 0
    gap = text[spans[idx - 1][1]:spans[idx][0]]
    if any(ch in _CLAUSE_PUNCT for ch in gap):
        return 2
    token = text[spans[idx][0]:spans[idx][1]].lower()
    if token in _CLAUSE_WORDS:
        return 1
    return 0


def _split_long_sentence(sentence: str, band: DifficultyBand) -> List[str]:
    """Cut an over-long sentence at clause boundaries, preserving every token.

    Walks forward one cut at a time, and every cut is hard-bounded to
    ``[start + min_words, start + max_words]``. That bound is the point: a
    free search for the nicest-looking clause boundary lets successive cuts
    drift in the same direction and compound, and two cuts pulled two tokens
    early leave a chunk four tokens over the ceiling -- which is a step the
    band promised the user would not appear.
    """
    spans = _word_spans(sentence)
    n = len(spans)
    if n <= band.max_words:
        return [sentence]

    window = max(1, (band.max_words - band.min_words) // 2 + 1)

    boundaries = [0]
    while n - boundaries[-1] > band.max_words:
        start = boundaries[-1]
        remaining = n - start

        # Spread the remaining cuts evenly around the middle of the band rather
        # than taking max_words each time and leaving a stub at the end.
        pieces = max(2, round(remaining / band.target_words))
        while math.ceil(remaining / pieces) > band.max_words:
            pieces += 1
        ideal = start + max(1, round(remaining / pieces))

        hi = min(start + band.max_words, n - 1)
        # Don't cut so late that the tail is too short to stand as a step.
        if n - hi < band.min_words:
            hi = max(start + 1, n - band.min_words)
        lo = max(start + 1, min(start + band.min_words, hi))
        ideal = max(lo, min(ideal, hi))

        best_idx, best_rank = ideal, _break_quality(sentence, spans, ideal)
        for delta in range(1, window + 1):
            for cand in (ideal - delta, ideal + delta):
                if cand < lo or cand > hi:
                    continue
                rank = _break_quality(sentence, spans, cand)
                if rank > best_rank:
                    best_idx, best_rank = cand, rank
        boundaries.append(best_idx)
    boundaries.append(n)

    pieces_out: List[str] = []
    for j in range(len(boundaries) - 1):
        start_char = 0 if j == 0 else spans[boundaries[j]][0]
        end_char = len(sentence) if j == len(boundaries) - 2 else spans[boundaries[j + 1]][0]
        piece = sentence[start_char:end_char].strip()
        if piece:
            pieces_out.append(piece)
    return pieces_out or [sentence]


_ENDS_SENTENCE_RE = re.compile(r"[.!?][\"')\]]*$")


def _merge_short(pieces: List[str], band: DifficultyBand) -> List[str]:
    """Merge under-length pieces with their neighbour."""
    merged: List[Tuple[str, int]] = []  # (text, word_count)
    for piece in pieces:
        count = len(_word_spans(piece))
        if merged:
            prev_text, prev_count = merged[-1]
            combined = prev_count + count
            short = count < band.min_words or prev_count < band.min_words
            # Normal merge keeps us inside the band. The second clause is the
            # escape hatch: a one- or two-word fragment standing alone is worse
            # for practice than a slightly over-length step.
            if short and (combined <= band.max_words or min(count, prev_count) <= 2):
                merged[-1] = (f"{prev_text} {piece}".strip(), combined)
                continue
        merged.append((piece, count))
    return [text for text, _ in merged]


def segment(text: str, difficulty: str = "medium") -> PracticeScript:
    """Split *text* into practice steps for the given difficulty tier.

    Difficulty controls chunk size only. The words are the user's, so tier does
    not touch vocabulary -- it decides how much you attempt in one breath.
    """
    band = get_band(difficulty)
    full = normalize_text(text)
    normalized = full[:MAX_SOURCE_CHARS]
    over_length = len(full) > MAX_SOURCE_CHARS

    pieces: List[str] = []
    for paragraph in _split_paragraphs(normalized):
        para_pieces: List[str] = []
        for sentence in _split_sentences(paragraph):
            para_pieces.extend(_split_long_sentence(sentence, band))
        # Merging is scoped to the paragraph so a step never spans a hard break.
        pieces.extend(_merge_short(para_pieces, band))

    over_cap = len(pieces) > MAX_STEPS
    if over_cap:
        logger.info("Segmented text produced %d steps; capping at %d", len(pieces), MAX_STEPS)
        pieces = pieces[:MAX_STEPS]

    steps: List[PracticeStep] = []
    for i, piece_text in enumerate(pieces):
        # The only note worth showing is the one the speaker has to act on:
        # this step stops mid-sentence, so don't let your intonation fall.
        mid_sentence = i < len(pieces) - 1 and not _ENDS_SENTENCE_RE.search(piece_text)
        steps.append(
            PracticeStep(
                index=i,
                text=piece_text,
                word_count=len(tokenize_words(piece_text)),
                note="continues in the next step" if mid_sentence else None,
            )
        )

    return PracticeScript(
        steps=steps,
        difficulty=band.name,
        pass_threshold=band.pass_threshold,
        generated_by="segmenter",
        source_label=f"Your text · {len(steps)} step{'s' if len(steps) != 1 else ''}",
        truncated=over_cap or over_length,
    )
