import re
from typing import List

# Shared regular expression for matching words (letters and apostrophes)
WORD_RE = re.compile(r"[a-zA-Z']+")

# Display-oriented variant: keeps digits and original case, for anything the
# user actually reads back (practice word chips, step word counts). Pasted
# speech routinely contains "in 2024" or "the 3 pillars"; dropping those
# tokens would desynchronise the on-screen words from what must be spoken.
DISPLAY_WORD_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_words(text: str) -> List[str]:
    """Tokenize text into a list of lowercase words."""
    if not text:
        return []
    return [w.lower() for w in WORD_RE.findall(text)]


def split_display_words(text: str) -> List[str]:
    """Split text into spoken tokens, preserving case and digits."""
    if not text:
        return []
    return DISPLAY_WORD_RE.findall(text)
