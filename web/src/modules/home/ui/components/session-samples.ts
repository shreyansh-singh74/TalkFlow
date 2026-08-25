import type { SessionSample } from "./session-card";

/**
 * Illustrative sessions for the landing page. Every diff here is a phoneme
 * substitution, which is what the scorer actually measures today — no stress,
 * rhythm or intonation claims.
 */
export const SAMPLES: SessionSample[] = [
  {
    id: "pronunciation",
    target: "The pronunciation was perfect.",
    heard: [
      { word: "The", ok: true },
      { word: "pronunciation", ok: false },
      { word: "was", ok: true },
      { word: "perfect.", ok: true },
    ],
    accuracy: 88,
    diffs: [
      { expected: "ə", actual: "ɛ" },
      { expected: "ʃ", actual: "s" },
    ],
    fix: {
      sound: "ə",
      word: "pro·nun·ci·a·tion",
      cue: "Relax your tongue to center. The schwa is neutral and unstressed — no jaw movement, no lip rounding.",
    },
    duration: "02:14",
  },
  {
    id: "schedule",
    target: "I’ll check the data and update the schedule.",
    heard: [
      { word: "I’ll", ok: true },
      { word: "check", ok: true },
      { word: "the", ok: true },
      { word: "data", ok: false },
      { word: "and", ok: true },
      { word: "update", ok: true },
      { word: "the", ok: true },
      { word: "schedule.", ok: false },
    ],
    accuracy: 79,
    diffs: [
      { expected: "eɪ", actual: "ɑ" },
      { expected: "dʒ", actual: "d" },
    ],
    fix: {
      sound: "eɪ",
      word: "day·tuh",
      cue: "Start the vowel high and glide down into it. Flattening to “dah-tuh” lands on a different vowel entirely.",
    },
    duration: "01:47",
  },
  {
    id: "thursday",
    target: "Could you send me the report by Thursday?",
    heard: [
      { word: "Could", ok: true },
      { word: "you", ok: true },
      { word: "send", ok: true },
      { word: "me", ok: true },
      { word: "the", ok: true },
      { word: "report", ok: true },
      { word: "by", ok: true },
      { word: "Thursday?", ok: false },
    ],
    accuracy: 91,
    diffs: [{ expected: "θ", actual: "t" }],
    fix: {
      sound: "θ",
      word: "Thurs·day",
      cue: "Tongue tip lightly between your teeth, then blow. /t/ stops the air completely; /θ/ lets it hiss through.",
    },
    duration: "03:02",
  },
];
