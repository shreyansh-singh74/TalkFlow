import type { Difficulty } from "@/types/practice";

/**
 * The coaches a brand-new account starts with.
 *
 * Each one must differ in **topic and difficulty** — that pair is what the
 * script generator reads. Three coaches with the same topic would generate the
 * same practice content under three different names, which is exactly what this
 * seed used to do.
 *
 * `instructions` shapes only how feedback is *worded*; it never selects content.
 */
export type DefaultCoach = {
  name: string;
  topic: string;
  difficulty: Difficulty;
  accent: string;
  focusSounds: string[];
  instructions: string;
};

const BASE_STYLE =
  "Keep every reply to one or two sentences. Name the single most important " +
  "correction and nothing else.";

export const DEFAULT_COACHES: readonly DefaultCoach[] = [
  {
    name: "Daily Conversation Coach",
    topic: "Everyday conversations — greetings, small talk, shops and cafés",
    difficulty: "easy",
    accent: "en-US",
    focusSounds: [],
    instructions: `${BASE_STYLE} Be warm and encouraging; this is a beginner's first practice.`,
  },
  {
    name: "Interview English Coach",
    topic: "Job interviews — describing experience, strengths and projects",
    difficulty: "medium",
    accent: "en-US",
    focusSounds: [],
    instructions: `${BASE_STYLE} Be direct and professional, the way an interviewer would be.`,
  },
  {
    name: "Pronunciation Drill Coach",
    topic: "Minimal pairs and consonant clusters that trip up English learners",
    difficulty: "hard",
    accent: "en-US",
    // The classic trouble set for most L2 English speakers.
    focusSounds: ["θ", "ð", "v", "w", "r", "l"],
    instructions: `${BASE_STYLE} Be clinical: name the phoneme that was wrong and what it was heard as.`,
  },
] as const;
