export type PronounceOpcode = {
  op: "equal" | "replace" | "delete" | "insert";
  expected: string;
  actual: string;
};

export type MisalignedWordPair = {
  expected: string;
  heard: string;
};

/** One phone from the acoustic scorer's alignment. `expected`/`actual` are IPA. */
export type PerPhonemeDetail = {
  expected: string;
  actual: string;
  accuracy: number;
  is_correct: boolean;
  distance?: number;
  confidence?: number;
};

export type StressPayload = {
  score: number;
  method: string;
  syllables: Array<{
    syllable: string;
    expected_stressed: boolean | null;
    score: number;
    cues?: Record<string, number>;
  }>;
};

export type TimingPayload = {
  score: number;
  speech_rate: number;
  articulation_rate: number;
  pace_label: "slow" | "natural" | "fast" | string;
  speech_fraction: number;
  pauses: Array<{ start: number; end: number; duration: number }>;
};

export type IntonationPayload = {
  score: number;
  dtw_distance: number;
  slope: number;
  label: "rising" | "falling" | "level" | string;
  contour: number[];
  reference_contour: number[];
};

export type PronunciationResultPayload = {
  type: "PRONUNCIATION_RESULT";
  turn_id: string;
  target_text: string;
  heard_text: string;
  score: number;
  expected_phonemes: string[];
  actual_phonemes: string[];
  errors: PronounceOpcode[];
  feedback: string[];
  misaligned_words?: MisalignedWordPair[];
  /** "acoustic_ctc" when the phoneme model ran, "text_proxy" when it didn't. */
  method?: string;
  per_phoneme?: PerPhonemeDetail[];
  accent?: string;
  audio_path?: string | null;
  stress?: StressPayload | null;
  timing?: TimingPayload | null;
  intonation?: IntonationPayload | null;
  diagnosis?: Record<string, unknown>;
  /** What this turn did to the step cursor. Absent on older servers. */
  practice_update?: PracticeUpdatePayload | null;
};

/**
 * The engine's verdict on the cursor after scoring a turn.
 *
 * `advanced` is true only when the score met the step's threshold, which is what
 * makes the tier meaningful: the client no longer decides for itself that a step
 * is done.
 */
export type PracticeUpdatePayload = {
  advanced: boolean;
  completed_sentence: boolean;
  session_complete: boolean;
  message: string;
};

export type PracticeTargetPayload = {
  type: "PRACTICE_TARGET";
  target_text: string;
  mode: "word" | "sentence";
  sentence: string;
  progress: {
    current: number;
    total: number;
  };
  step_index?: number;
  pass_threshold?: number;
  /**
   * True when this step arrived because the previous one was passed, rather than
   * because the learner navigated. The previous score and feedback are kept on
   * screen in that case, so earning a pass does not erase the feedback you just
   * earned.
   */
  advanced_from_pass?: boolean;
  /** Why the cursor did not move, when it did not. */
  gate_message?: string | null;
  /** Neighbouring lines; only sent for custom-text (speech-prep) sessions. */
  context_before?: string | null;
  context_after?: string | null;
  note?: string | null;
};

/** One phone the speaker actually got wrong, with the evidence behind it. */
export type PhoneBreakdownEntry = {
  phone: string;
  label: string;
  observations: number;
  error_rate: number;
  avg_accuracy: number;
};

/**
 * Anything nullable here was *not measured* for that session — the prosody
 * scorers are config-gated and the text-proxy scorer produces no phone data.
 * Render null as absent; never substitute a placeholder number.
 */
export type SessionAnalysisReport = {
  overall_score: number | null;
  accuracy_score: number | null;
  fluency_score: number | null;

  words_spoken: number;
  sentences_completed: number;
  sentences_total?: number;
  wpm: number | null;
  avg_pause_duration: number | null;
  longest_pause: number | null;
  total_speaking_time: number | null;

  mispronounced_words: string[];
  difficult_sounds: string[];
  phone_breakdown?: PhoneBreakdownEntry[];
  stress_mistakes: string[] | null;
  syllable_mistakes: string[] | null;
  intonation_issues: string[] | null;
  words_skipped: string[];
  extra_inserted_words: string[];

  strengths: string[];
  areas_to_improve: string[];

  coach_feedback: string;
  difficulty?: "easy" | "medium" | "hard";
  pass_threshold?: number;
  scoring_method?: string | null;
  /**
   * Steps the learner skipped past. Reported so "completed N steps" can never
   * quietly include a step that was never passed.
   */
  steps_skipped?: number;
  skipped_step_indexes?: number[];
};

/**
 * One scored turn as stored on the session.
 *
 * `score` and `at` are the field names *both* the dashboard aggregate and the
 * session timeline read. Changing a name here means changing them there.
 */
export type PersistedTurnEntry = {
  at: string;
  turn_id: string;
  target_text: string;
  heard_text: string;
  score: number;
  mode?: "word" | "sentence";
  coach_name?: string;
  feedback: string[];
  misaligned_words?: MisalignedWordPair[];
};

export type SessionPhonemeDataPersisted = {
  entries: PersistedTurnEntry[];
  report?: SessionAnalysisReport;
};

export type ArpabetSyllableItem = {
  phones: string;
  display: string;
  /** Primary stress only — exactly one syllable per word has this set. */
  stressed: boolean;
  /** Real ARPABET level: 1 primary, 2 secondary, 0 none. */
  stress_level?: number;
};

/**
 * One phone from the reference dictionary, mirroring the backend's
 * `PhonemeEntry`. `symbol` is a stress-stripped ARPABET base (`"AE"`, never
 * `"AE1"`).
 *
 * `expected_duration_ms` is a *measurement* slot — null until forced alignment
 * lands in Phase 5. The mouth animation does not wait for it and must not fill
 * it; see the header of `@/lib/viseme-timing` for why that separation matters.
 */
export type ApiPhoneme = {
  symbol: string;
  stress: number;
  /** Coarse mouth-shape group 0–9; refined per-symbol in `@/lib/viseme-poses`. */
  viseme_id: number;
  /** Index into `arpabet_syllables`. */
  syllable_index?: number;
  confidence?: number | null;
  expected_duration_ms?: number | null;
};

export type PronunciationReferenceResponse = {
  word: string;
  arpabet_syllables: ArpabetSyllableItem[];
  /**
   * Optional because `usePronunciationReference` holds a module-level cache
   * that is never invalidated: a tab open across a deploy can serve a payload
   * predating these fields. Consumers must tolerate their absence.
   */
  ipa?: string;
  phonemes?: ApiPhoneme[];
};

export interface PhonemeSegment {
  phoneme: string;
  expected: string;
  actual: string;
  accuracy: number;
  is_correct: boolean;
  feedback?: string | null;
  suggestions?: string[] | null;
}

export interface WordPhonemeAnalysis {
  word: string;
  expected_ipa: string;
  expected_phonemes: string[];
  actual_phonemes: string[];
  segments: PhonemeSegment[];
  word_accuracy: number;
  phoneme_matches: number;
  total_phonemes: number;
  suggestions: string[];
}

export interface PhonemeErrorCount {
  phoneme: string;
  count: number;
}

export interface SentencePhonemeAnalysis {
  sentence: string;
  words: WordPhonemeAnalysis[];
  overall_accuracy: number;
  problematic_phonemes: string[];
  mastered_phonemes: string[];
  most_common_errors: PhonemeErrorCount[];
}
