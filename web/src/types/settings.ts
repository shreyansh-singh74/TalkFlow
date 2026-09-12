import type { userSettings } from "@/db/schema";

/**
 * Types shared by the settings UI (a client component) and the server helpers.
 *
 * `UserSettings` is derived from the Drizzle table rather than restated, so a
 * column rename is a compile error in the form instead of a silent `undefined`
 * in an input.
 */
export type UserSettings = typeof userSettings.$inferSelect;

/** The subset of fields the settings and onboarding forms may send. */
export type SettingsPatch = Partial<{
  displayName: string;
  nativeLanguage: string;
  targetAccent: string;
  ttsVoice: string;
  ttsRate: number;
  retainAudio: boolean;
  practiceGoal: string;
  level: string;
  onboarded: boolean;
}>;

/** One target accent, as advertised by the backend's scoring profiles. */
export type AccentOption = {
  code: string;
  label: string;
  tts_voice: string;
  rhotic: boolean;
  notes: string;
};

/** One first-language interference profile. */
export type L1Option = {
  code: string;
  label: string;
  weak_phones: string[];
};

export type SettingsCatalog = {
  accents: AccentOption[];
  l1Profiles: L1Option[];
};

/**
 * Plan state as the UI and the gates both need it.
 *
 * Declared here rather than in lib/billing.ts so client components can import it
 * as a plain type -- billing.ts is server-only (it owns the DB query).
 */
export type PlanId = "free" | "pro";

export type QuotaState = {
  plan: PlanId;
  used: number;
  /** null means unlimited. */
  limit: number | null;
  remaining: number | null;
  allowed: boolean;
  periodStart: string;
};

export type SettingsResponse = {
  settings: UserSettings;
  quota: QuotaState;
};
