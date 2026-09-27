/**
 * Shared phonetic copy for the landing page.
 *
 * Every respelling/IPA pair here is the same sentence the demo section scores,
 * so the hero animation, the ticker band and the session mock all describe one
 * consistent example instead of three unrelated ones.
 */

export interface PhonemeToken {
  /** How the word is spelled. */
  word: string;
  /** Plain-English respelling, the middle rung of the animation. */
  respell: string;
  /** IPA, the last rung. */
  ipa: string;
  /** Flagged by the scorer in the example session. */
  focus?: boolean;
}

/** "I'll check the data and update the schedule." */
export const HERO_LINE: readonly PhonemeToken[] = [
  { word: "I’ll", respell: "ayl", ipa: "aɪl" },
  { word: "check", respell: "chek", ipa: "tʃɛk" },
  { word: "the", respell: "thuh", ipa: "ðə" },
  { word: "data", respell: "day·tuh", ipa: "ˈdeɪ.tə", focus: true },
  { word: "and", respell: "and", ipa: "ænd" },
  { word: "update", respell: "up·dayt", ipa: "ʌpˈdeɪt" },
  { word: "the", respell: "thuh", ipa: "ðə" },
  { word: "schedule", respell: "skeh·jool", ipa: "ˈskɛ.dʒuːl", focus: true },
];

export const HERO_SENTENCE = "I’ll check the data and update the schedule.";

/** Word → "sounds like" pairs for the ticker band between sections. Each word
    is respelled into plain-English syllables, with the stressed syllable marked,
    so a learner can read it aloud without knowing IPA. */
export interface TickerSyllable {
  text: string;
  stress?: boolean;
}

export const TICKER_PAIRS: readonly {
  word: string;
  sounds: readonly TickerSyllable[];
}[] = [
  {
    word: "schedule",
    sounds: [{ text: "skeh", stress: true }, { text: "jool" }],
  },
  {
    word: "thursday",
    sounds: [{ text: "thurz", stress: true }, { text: "day" }],
  },
  {
    word: "pronunciation",
    sounds: [
      { text: "pruh" },
      { text: "nun" },
      { text: "see" },
      { text: "ay", stress: true },
      { text: "shun" },
    ],
  },
  {
    word: "data",
    sounds: [{ text: "day", stress: true }, { text: "tuh" }],
  },
  {
    word: "comfortable",
    sounds: [
      { text: "kumf", stress: true },
      { text: "tuh" },
      { text: "bul" },
    ],
  },
  {
    word: "algorithm",
    sounds: [
      { text: "al", stress: true },
      { text: "guh" },
      { text: "rith" },
      { text: "uhm" },
    ],
  },
  {
    word: "vegetable",
    sounds: [
      { text: "vej", stress: true },
      { text: "tuh" },
      { text: "bul" },
    ],
  },
  {
    word: "particularly",
    sounds: [
      { text: "par" },
      { text: "tik", stress: true },
      { text: "yuh" },
      { text: "luh" },
      { text: "lee" },
    ],
  },
  {
    word: "entrepreneur",
    sounds: [
      { text: "on" },
      { text: "truh" },
      { text: "pruh" },
      { text: "nur", stress: true },
    ],
  },
  {
    word: "clothes",
    sounds: [{ text: "klohz", stress: true }],
  },
];
