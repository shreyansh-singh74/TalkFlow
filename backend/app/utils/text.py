import re
from typing import List

# Shared regular expression for matching words (letters and apostrophes)
WORD_RE = re.compile(r"[a-zA-Z']+")

def tokenize_words(text: str) -> List[str]:
    """Tokenize text into a list of lowercase words."""
    if not text:
        return []
    return [w.lower() for w in WORD_RE.findall(text)]
