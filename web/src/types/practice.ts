/**
 * Practice-script types.
 *
 * These are produced by the FastAPI backend (`POST /api/practice/script`) and
 * persisted verbatim into `practice_sessions.script`, so the field names are
 * snake_case — matching every other backend-produced payload in `src/types/`.
 * Don't camelCase them on the way in; the WebSocket engine reads the same shape
 * back out of the DB when the session starts.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type SessionSource = "coach" | "custom";

/** How the steps came to exist. Surfaced in the UI so a degraded run is visible. */
export type GeneratedBy = "llm" | "fallback" | "segmenter";

export type PracticeStep = {
  index: number;
  text: string;
  word_count: number;
  /** e.g. "continues in the next step" — set by the segmenter, not the LLM. */
  note?: string | null;
};

export type PracticeScript = {
  steps: PracticeStep[];
  difficulty: Difficulty;
  /** Score a step must reach to advance. Comes from the difficulty band. */
  pass_threshold: number;
  generated_by: GeneratedBy;
  /** Human label, e.g. "Job interviews · Medium" or "Your text · 14 steps". */
  source_label: string;
  /** True when the source text was longer than the 40-step cap. */
  truncated?: boolean;
};

export type DifficultyBand = {
  name: Difficulty;
  label: string;
  min_words: number;
  max_words: number;
  pass_threshold: number;
  description: string;
};

export type DifficultyBandsResponse = {
  bands: DifficultyBand[];
};

/** Request body for the script endpoint (mirrors `ScriptRequest` in Python). */
export type ScriptRequest = {
  source: SessionSource;
  difficulty: Difficulty;
  step_count?: number;
  topic?: string;
  coach_name?: string;
  accent?: string;
  focus_sounds?: string[];
  /** First language. Only used when the coach supplied no focus sounds. */
  l1?: string;
  source_text?: string;
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * Mirrors `DIFFICULTY_BANDS[*].pass_threshold` in
 * `backend/app/services/practice_content.py`. Used only as a client-side
 * placeholder before the first PRACTICE_TARGET arrives — the server's value is
 * authoritative and overwrites this as soon as a step is issued.
 */
export const DIFFICULTY_PASS_THRESHOLDS: Record<Difficulty, number> = {
  easy: 80,
  medium: 88,
  hard: 93,
};

export const ACCENT_OPTIONS = [
  { value: "en-US", label: "American (en-US)" },
  { value: "en-GB", label: "British (en-GB)" },
  { value: "en-IN", label: "Indian (en-IN)" },
  { value: "en-AU", label: "Australian (en-AU)" },
] as const;

export function totalWords(script: PracticeScript | null | undefined): number {
  if (!script) return 0;
  return script.steps.reduce((sum, step) => sum + step.word_count, 0);
}
