"""Pronunciation respelling service with dialect-specific lookup, LLM generation, and cache."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.services.phoneme_analysis_service import phoneme_analyzer
from app.utils.pronunciation_reference import build_syllable_rows

logger = logging.getLogger(__name__)

# Cache file path
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resources")
CACHE_FILE = os.path.join(CACHE_DIR, "respellings_cache.json")

# Predefined dictionary for common words to ensure zero-latency/instant response
# Format: {word_lower: {dialect_key: [{"display": str, "stressed": bool}]}}
COMMON_WORDS: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "naturally": {
        "en-in": [
            {"display": "na", "stressed": True},
            {"display": "choo", "stressed": False},
            {"display": "ruh", "stressed": False},
            {"display": "lee", "stressed": False}
        ],
        "en-us": [
            {"display": "na", "stressed": True},
            {"display": "chuh", "stressed": False},
            {"display": "ruh", "stressed": False},
            {"display": "lee", "stressed": False}
        ],
        "en-gb": [
            {"display": "na", "stressed": True},
            {"display": "chuh", "stressed": False},
            {"display": "ruh", "stressed": False},
            {"display": "lee", "stressed": False}
        ]
    },
    "english": {
        "en-in": [
            {"display": "ingg", "stressed": True},
            {"display": "lish", "stressed": False}
        ],
        "en-us": [
            {"display": "ingg", "stressed": True},
            {"display": "lish", "stressed": False}
        ],
        "en-gb": [
            {"display": "ingg", "stressed": True},
            {"display": "lish", "stressed": False}
        ]
    },
    "speak": {
        "en-in": [{"display": "speek", "stressed": True}],
        "en-us": [{"display": "speek", "stressed": True}],
        "en-gb": [{"display": "speek", "stressed": True}]
    },
    "pronunciation": {
        "en-in": [
            {"display": "proh", "stressed": False},
            {"display": "nuhn", "stressed": False},
            {"display": "see", "stressed": False},
            {"display": "ay", "stressed": True},
            {"display": "shuhn", "stressed": False}
        ],
        "en-us": [
            {"display": "proh", "stressed": False},
            {"display": "nuhn", "stressed": False},
            {"display": "see", "stressed": False},
            {"display": "ay", "stressed": True},
            {"display": "shuhn", "stressed": False}
        ],
        "en-gb": [
            {"display": "pruh", "stressed": False},
            {"display": "nuhn", "stressed": False},
            {"display": "see", "stressed": False},
            {"display": "ay", "stressed": True},
            {"display": "shuhn", "stressed": False}
        ]
    },
    "beautiful": {
        "en-in": [
            {"display": "byoo", "stressed": True},
            {"display": "tuh", "stressed": False},
            {"display": "fuhl", "stressed": False}
        ],
        "en-us": [
            {"display": "byoo", "stressed": True},
            {"display": "tuh", "stressed": False},
            {"display": "fuhl", "stressed": False}
        ],
        "en-gb": [
            {"display": "byoo", "stressed": True},
            {"display": "tuh", "stressed": False},
            {"display": "fuhl", "stressed": False}
        ]
    }
}

class PhonemeRespellingService:
    def __init__(self):
        self.cache: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._load_cache()

    def _load_cache(self):
        """Load persistent cache from disk."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self.cache = json.load(f)
                logger.info("Loaded respellings cache with %d entries", len(self.cache))
            except Exception:
                logger.exception("Failed to load respellings cache from disk")

    def _save_cache(self):
        """Save persistent cache to disk."""
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
        except Exception:
            logger.exception("Failed to save respellings cache to disk")

    def _get_dialect_name(self, lang: str) -> str:
        """Map dialect code to user-friendly name."""
        l = (lang or "").lower().strip()
        if "in" in l:
            return "Indian English"
        elif "gb" in l or "uk" in l:
            return "British English"
        return "American English"

    def _get_dialect_key(self, lang: str) -> str:
        """Standardize dialect key for storage."""
        l = (lang or "").lower().strip()
        if "in" in l:
            return "en-in"
        elif "gb" in l or "uk" in l:
            return "en-gb"
        return "en-us"

    def _local_fallback(self, word: str) -> List[Dict[str, Any]]:
        """Fallback to G2P + pyphen syllable division."""
        try:
            tokens = phoneme_analyzer.raw_arpabet_tokens_for_word(word)
            rows = build_syllable_rows(word, tokens)
            return [
                {
                    "display": r["display"],
                    "stressed": r["stressed"],
                    "phones": r["phones"]
                }
                for r in rows
            ]
        except Exception:
            logger.exception("Local G2P fallback failed for %s", word)
            return [{"display": word, "stressed": True, "phones": ""}]

    async def get_dialect_respelling(self, word: str, lang: str) -> List[Dict[str, Any]]:
        """Get dialect-specific phonetic respelling syllables."""
        w = re.sub(r"[^\w]", "", (word or "").lower())
        if not w:
            return []

        dialect_key = self._get_dialect_key(lang)

        # 1. Check predefined dictionary
        if w in COMMON_WORDS:
            dialect_data = COMMON_WORDS[w]
            if dialect_key in dialect_data:
                return dialect_data[dialect_key]
            # Fallback to en-us in predefined
            if "en-us" in dialect_data:
                return dialect_data["en-us"]

        # 2. Check local file cache
        if w in self.cache:
            dialect_data = self.cache[w]
            if dialect_key in dialect_data:
                return dialect_data[dialect_key]
            if "en-us" in dialect_data:
                return dialect_data["en-us"]

        # 3. Call OpenRouter to generate Google-style respellings
        if settings.OPENROUTER_API_KEY:
            try:
                dialect_name = self._get_dialect_name(lang)
                prompt = (
                    f"Provide the syllable division and Google-style simplified phonetic respelling for the English word '{w}' "
                    f"in the '{dialect_name}' dialect.\n\n"
                    "Requirements:\n"
                    "- The respellings must be simple and intuitive for a learner (like 'choo', 'ruh', 'lee', 'ingg', 'lish').\n"
                    "- Avoid any linguistic IPA characters (like ə, ɪ, ʌ).\n"
                    "- Mark the primary stressed syllable with 'stressed': true.\n\n"
                    "Format the output strictly as a JSON array of objects representing the syllables in order, without any markdown code block wrapping. Example:\n"
                    "[\n"
                    "  {\"display\": \"na\", \"stressed\": true},\n"
                    "  {\"display\": \"choo\", \"stressed\": false},\n"
                    "  {\"display\": \"ruh\", \"stressed\": false},\n"
                    "  {\"display\": \"lee\", \"stressed\": false}\n"
                    "]"
                )

                headers = {
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "TalkFlow",
                }

                payload = {
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a professional linguist who outputs ONLY a raw JSON array of English pronunciation syllables. Do not include markdown code block backticks (```) or other text.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 150,
                }

                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        settings.OPENROUTER_API_URL,
                        headers=headers,
                        json=payload,
                        timeout=8.0,
                    )
                
                if resp.status_code == 200:
                    response_json = resp.json()
                    choices = response_json.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "").strip()
                        # Clean up markdown code blocks if the model ignored system prompts
                        content = re.sub(r"^```(json)?\s*", "", content, flags=re.IGNORECASE)
                        content = re.sub(r"\s*```$", "", content)
                        
                        syllables = json.loads(content)
                        if isinstance(syllables, list) and len(syllables) > 0:
                            # Normalize structure
                            normalized = []
                            for s in syllables:
                                if isinstance(s, dict) and "display" in s:
                                    normalized.append({
                                        "display": str(s["display"]).lower(),
                                        "stressed": bool(s.get("stressed", False)),
                                        "phones": ""
                                    })
                            
                            if normalized:
                                if w not in self.cache:
                                    self.cache[w] = {}
                                self.cache[w][dialect_key] = normalized
                                self._save_cache()
                                return normalized
            except Exception as e:
                logger.warning("Failed to generate respelling via LLM for '%s' (%s): %s", w, lang, e)

        # 4. Fallback to local G2P
        return self._local_fallback(w)

# Singleton instance
phoneme_respelling_service = PhonemeRespellingService()
