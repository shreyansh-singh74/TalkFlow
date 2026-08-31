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

/** Word → IPA pairs for the ticker band between sections. */
export const TICKER_PAIRS: readonly { word: string; ipa: string }[] = [
  { word: "schedule", ipa: "ˈskɛdʒuːl" },
  { word: "thursday", ipa: "ˈθɜz.deɪ" },
  { word: "pronunciation", ipa: "prəˌnʌn.siˈeɪ.ʃən" },
  { word: "data", ipa: "ˈdeɪ.tə" },
  { word: "comfortable", ipa: "ˈkʌmf.tə.bəl" },
  { word: "algorithm", ipa: "ˈæl.ɡə.ˌrɪ.ðəm" },
  { word: "vegetable", ipa: "ˈvɛdʒ.tə.bəl" },
  { word: "particularly", ipa: "pəˈtɪk.jə.lə.li" },
  { word: "entrepreneur", ipa: "ˌɒn.trə.prəˈnɜː" },
  { word: "clothes", ipa: "kləʊðz" },
];
