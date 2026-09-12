# app/schemas/practice.py
"""Wire types for generated practice content.

Field names are snake_case because this JSON is stored verbatim in the
``practice_sessions.script`` JSONB column and read by the web app, which
already models every backend-produced payload in snake_case
(``PracticeTargetPayload``, ``SessionAnalysisReport``, ...). Keeping one
convention means no mapping layer between the generator, Postgres, and React.
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]
ScriptSource = Literal["coach", "custom"]
GeneratedBy = Literal["llm", "fallback", "segmenter"]


class PracticeStep(BaseModel):
    index: int
    text: str
    word_count: int
    #: Free-text hint shown under the step, e.g. "split from a longer sentence".
    note: Optional[str] = None


class PracticeScript(BaseModel):
    steps: List[PracticeStep] = Field(default_factory=list)
    difficulty: Difficulty = "medium"
    pass_threshold: float = 88.0
    generated_by: GeneratedBy = "fallback"
    #: Human label for the session header, e.g. "Job interviews · Medium".
    source_label: str = ""
    #: True when the source text produced more steps than the cap allows.
    truncated: bool = False


class ScriptRequest(BaseModel):
    source: ScriptSource = "coach"
    difficulty: Difficulty = "medium"
    step_count: int = Field(default=10, ge=1, le=40)
    # Coach-backed generation
    topic: Optional[str] = None
    coach_name: Optional[str] = None
    accent: str = "en-US"
    focus_sounds: List[str] = Field(default_factory=list)
    #: Learner's first language. Only consulted when L1_AWARE_ENABLED and the
    #: coach supplied no focus sounds of its own.
    l1: Optional[str] = None
    # Custom pasted text
    source_text: Optional[str] = None
