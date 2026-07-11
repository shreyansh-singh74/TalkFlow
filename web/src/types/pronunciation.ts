export type PronounceOpcode = {
  op: "equal" | "replace" | "delete" | "insert";
  expected: string;
  actual: string;
};

export type MisalignedWordPair = {
  expected: string;
  heard: string;
};

export type PronunciationResultPayload = {
  type: "PRONUNCIATION_RESULT";
  turn_id: string;
  target_text: string;
  deepgram_text: string | null;
  heard_text: string;
  score: number;
  expected_phonemes: string[];
  actual_phonemes: string[];
  errors: PronounceOpcode[];
  feedback: string[];
  misaligned_words?: MisalignedWordPair[];
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
};

export type SessionAnalysisReport = {
  overall_score: number;
  fluency_score: number;
  clarity_score: number;
  confidence_score: number;
  accuracy_score: number;
  
  words_spoken: number;
  sentences_completed: number;
  wpm: number;
  avg_pause_duration: number;
  longest_pause: number;
  total_speaking_time: number;
  
  mispronounced_words: string[];
  difficult_sounds: string[];
  stress_mistakes: string[];
  syllable_mistakes: string[];
  intonation_issues: string[];
  words_skipped: string[];
  extra_inserted_words: string[];
  
  strengths: string[];
  areas_to_improve: string[];
  
  coach_feedback: string;
};

export type MeetingPhonemeDataPersisted = {
  entries: Array<{
    at: string;
    turn_id: string;
    target_text: string;
    heard_text: string;
    score: number;
    mode?: "word" | "sentence";
    agent_name?: string;
    feedback: string[];
  }>;
  report?: SessionAnalysisReport;
};

export type ArpabetSyllableItem = {
  phones: string;
  display: string;
  stressed: boolean;
};

export type PronunciationReferenceResponse = {
  word: string;
  arpabet_syllables: ArpabetSyllableItem[];
};
