"""First-language interference profiles.

``L1_AWARE_ENABLED`` existed as a flag that read an env var and did nothing.
This is the data it needed: for a given first language, which English sounds
that language's phonology is least likely to prepare a learner for.

Two honest caveats, both deliberate:

* These are **curated tendencies**, not a measured model. They come from the
  standard contrastive-analysis literature (and from what English teachers for
  each L1 actually drill), they are listed in one reviewable table, and nobody
  should read a per-L1 *probability* into them.
* A profile biases *content selection and coaching vocabulary*. It never lowers
  a score and never marks a phone correct: a learner who nails a "predicted
  weak" sound gets a full score and sees it, and one who does not is measured
  the same way whether or not their L1 predicted it. That keeps the profiles
  useful instead of flattering.

Phones are written as bare IPA symbols, the same convention the session report
(`difficult_sounds`), the coach seeds (`focus_sounds`), and the drill queue
(`sound_goals.phone`) already use -- so a predicted weak sound, a measured weak
sound, and a drill can be compared with a string equality.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence


@dataclass(frozen=True)
class L1Profile:
    code: str
    label: str
    #: Bare IPA symbols, ordered most-interfering first.
    weak_phones: Sequence[str]
    #: What the interference actually is, for the coach prompt.
    pattern: str


_PROFILES: Sequence[L1Profile] = (
    L1Profile(
        code="es",
        label="Spanish",
        weak_phones=("ɪ", "i", "æ", "ɛ", "v", "b", "d", "ð", "s", "θ", "z"),
        pattern=(
            "no vowel-length contrast (ship/sheep), b–v merged, initial "
            "s+consonant clusters are broken up (speak → espeak), and final "
            "voiced consonants are devoiced"
        ),
    ),
    L1Profile(
        code="zh",
        label="Mandarin Chinese",
        weak_phones=("l", "n", "θ", "ð", "s", "sh", "v", "w", "ɪ", "ŋ"),
        pattern=(
            "word-final consonants and consonant clusters are reduced, "
            "θ/ð become s/z, l and n are unstable, and the tense/lax vowel "
            "pairs are not distinguished"
        ),
    ),
    L1Profile(
        code="ja",
        label="Japanese",
        weak_phones=("r", "l", "θ", "s", "ð", "z", "v", "b", "ɪ", "i"),
        pattern=(
            "r and l are one sound, θ/ð become s/z, v becomes b, and a vowel is "
            "inserted to break up consonant clusters (street → sutoriito)"
        ),
    ),
    L1Profile(
        code="ko",
        label="Korean",
        weak_phones=("r", "l", "θ", "s", "ð", "d", "f", "p", "v", "b"),
        pattern=(
            "r and l are one phoneme, θ/ð become s/d, f and v become p and b, "
            "and clusters get an inserted vowel"
        ),
    ),
    L1Profile(
        code="hi",
        label="Hindi",
        weak_phones=("v", "w", "θ", "t", "ð", "d", "z", "ɪ", "i", "ʃ"),
        pattern=(
            "v and w are one sound, θ/ð are replaced by dental stops, s+cluster "
            "openings gain an initial vowel (school → iskool), and vowel length "
            "distinctions are not made"
        ),
    ),
    L1Profile(
        code="ar",
        label="Arabic",
        weak_phones=("p", "b", "v", "f", "ɪ", "i", "æ", "ɛ", "ŋ", "ʃ"),
        pattern=(
            "p and b are one sound, v becomes f, the tense/lax vowel pairs are "
            "neutralised, and initial s+clusters gain a vowel"
        ),
    ),
    L1Profile(
        code="pt",
        label="Portuguese",
        weak_phones=("θ", "f", "ð", "d", "v", "b", "ɪ", "i", "h", "r"),
        pattern=(
            "θ becomes f or s, final -ed and other clusters are reduced, h is "
            "often silent, and r is produced further back than the English r"
        ),
    ),
    L1Profile(
        code="ru",
        label="Russian",
        weak_phones=("θ", "s", "ð", "z", "w", "v", "æ", "ɛ", "ɪ", "i"),
        pattern=(
            "θ/ð become s/z, w becomes v, the English r is rolled, and final "
            "voiced consonants are devoiced"
        ),
    ),
    L1Profile(
        code="fr",
        label="French",
        weak_phones=("h", "θ", "s", "ð", "z", "tʃ", "dʒ", "ɪ", "i", "ŋ"),
        pattern=(
            "h is dropped, θ/ð become s/z, word stress falls on the final "
            "syllable, and the front rounded vowels shift the whole vowel space"
        ),
    ),
    L1Profile(
        code="de",
        label="German",
        weak_phones=("v", "w", "θ", "s", "ð", "z", "æ", "ɛ", "ɪ", "i"),
        pattern=(
            "v and w are swapped, θ/ð become s/z, final consonants are "
            "devoiced (dog → dock), and the u vowel is rounded"
        ),
    ),
    L1Profile(
        code="vi",
        label="Vietnamese",
        weak_phones=("z", "s", "ʃ", "tʃ", "θ", "t", "ð", "d", "ɪ", "i"),
        pattern=(
            "word-final consonants and all final clusters are dropped or "
            "simplified, ʃ becomes s, and tense/lax vowels are not distinguished"
        ),
    ),
    L1Profile(
        code="th",
        label="Thai",
        weak_phones=("r", "l", "θ", "t", "ð", "d", "v", "w", "ɪ", "i"),
        pattern=(
            "r and l are unstable, final consonants are reduced, θ/ð become "
            "t/d, and clusters are simplified"
        ),
    ),
    L1Profile(
        code="tr",
        label="Turkish",
        weak_phones=("θ", "t", "ð", "d", "w", "v", "ŋ", "æ", "ɛ", "ɪ", "i"),
        pattern=(
            "θ/ð become t/d, w becomes v, ŋ becomes ŋg, and final consonants "
            "are devoiced"
        ),
    ),
    L1Profile(
        code="pl",
        label="Polish",
        weak_phones=("θ", "f", "ð", "v", "æ", "ɛ", "ɪ", "i", "w", "v"),
        pattern=(
            "θ/ð become f/v, final consonants are devoiced, and the tense/lax "
            "vowel pairs are neutralised"
        ),
    ),
    L1Profile(
        code="other",
        label="Other / prefer not to say",
        weak_phones=(),
        pattern="",
    ),
)

L1_PROFILES: Dict[str, L1Profile] = {profile.code: profile for profile in _PROFILES}

#: Spellings that show up in the wild (ISO codes, English names, BCP-47 tags).
_ALIASES: Dict[str, str] = {
    "spa": "es", "esp": "es", "spanish": "es", "es-es": "es", "es-mx": "es",
    "cmn": "zh", "zho": "zh", "chi": "zh", "chinese": "zh", "zh-cn": "zh",
    "jp": "ja", "jpn": "ja", "japanese": "ja", "ja-jp": "ja",
    "kor": "ko", "korean": "ko", "ko-kr": "ko",
    "hin": "hi", "hindi": "hi", "hi-in": "hi",
    "ara": "ar", "arabic": "ar",
    "por": "pt", "portuguese": "pt", "pt-br": "pt", "pt-pt": "pt",
    "rus": "ru", "russian": "ru",
    "fra": "fr", "fre": "fr", "french": "fr", "fr-fr": "fr",
    "ger": "de", "deu": "de", "german": "de", "de-de": "de",
    "vie": "vi", "vietnamese": "vi",
    "tha": "th", "thai": "th",
    "tur": "tr", "turkish": "tr",
    "pol": "pl", "polish": "pl",
    "en": "other",
}


def resolve_l1_code(l1: Optional[str]) -> Optional[str]:
    """Normalise an L1 identifier, or ``None`` when there is nothing to resolve."""
    if not l1:
        return None
    raw = l1.strip().lower().replace("_", "-")
    if not raw:
        return None
    if raw in L1_PROFILES:
        return raw
    if raw in _ALIASES:
        return _ALIASES[raw]
    # "hi-IN" -> "hi"
    return _ALIASES.get(raw.split("-")[0], None)


def get_l1_profile(l1: Optional[str]) -> Optional[L1Profile]:
    code = resolve_l1_code(l1)
    return L1_PROFILES.get(code) if code else None


def weak_phones_for(l1: Optional[str], limit: int = 6) -> List[str]:
    """The predicted-weak phones for an L1, capped for a prompt-sized list."""
    profile = get_l1_profile(l1)
    if not profile:
        return []
    return list(profile.weak_phones[:limit])


def merge_focus_sounds(
    base: Optional[Sequence[str]], extra: Optional[Sequence[str]], limit: int = 6
) -> List[str]:
    """Combine explicit coach focus sounds with L1-predicted ones.

    Explicit choices win, because a coach set to "the sounds I keep getting
    wrong" outranks a generic prediction about the learner's first language.
    """
    merged: List[str] = []
    for sound in list(base or []) + list(extra or []):
        sound = (sound or "").strip()
        if sound and sound not in merged:
            merged.append(sound)
    return merged[:limit]


def interference_note(l1: Optional[str]) -> Optional[str]:
    """A one-line coaching note for the LLM, or None when there is nothing to say."""
    profile = get_l1_profile(l1)
    if not profile or not profile.pattern:
        return None
    sounds = ", ".join(f"/{p}/" for p in profile.weak_phones[:4])
    return (
        f"The learner's first language is {profile.label}. Typical interference: "
        f"{profile.pattern}. Watch {sounds} specifically, and when one of them is "
        "wrong, name it once and move on."
    )


def l1_choices() -> List[Dict[str, object]]:
    """Options for the onboarding picker."""
    return [
        {
            "code": profile.code,
            "label": profile.label,
            "weak_phones": list(profile.weak_phones[:6]),
        }
        for profile in _PROFILES
    ]
