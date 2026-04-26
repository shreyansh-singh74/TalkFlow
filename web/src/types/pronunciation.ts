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

export type MeetingPhonemeDataPersisted = {
  entries: Array<{
    at: string;
    turn_id: string;
    target_text: string;
    heard_text: string;
    score: number;
    feedback: string[];
  }>;
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
