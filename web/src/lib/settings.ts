import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { fetchPracticeCatalog } from "@/lib/backend-fetch";
import type {
  AccentOption,
  L1Option,
  SettingsCatalog,
  SettingsPatch,
  UserSettings,
} from "@/types/settings";

/**
 * Read the learner's settings, creating the row on first access.
 *
 * Every authenticated surface needs settings (the dashboard gate needs
 * `onboardedAt`, session creation needs the accent), so "create on read" beats
 * "create on sign-up plus repair-if-missing": there is exactly one code path,
 * and an account that predates this table behaves identically to a new one.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [created] = await db
    .insert(userSettings)
    .values({ userId })
    .onConflictDoNothing({ target: userSettings.userId })
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  // The insert conflicted, so the row is there; a miss here means it was deleted
  // between the two statements. Retry once through the same path.
  if (existing) return existing;
  return getUserSettings(userId);
}

/** Apply a validated patch and return the updated row. */
export async function updateUserSettings(
  userId: string,
  patch: SettingsPatch
): Promise<UserSettings> {
  await getUserSettings(userId);

  const { onboarded, ...columns } = patch;
  const [updated] = await db
    .update(userSettings)
    .set({
      ...columns,
      updatedAt: new Date(),
      ...(onboarded ? { onboardedAt: new Date() } : {}),
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  return updated;
}

/**
 * The accent and L1 lists the pickers render.
 *
 * They come from the backend because that is where scoring resolves them: if the
 * UI kept its own copy, an accent could disappear from the picker while the
 * scorer still accepted it (or vice versa). The literals below are only the
 * "backend unreachable" fallback, so the settings page still renders offline.
 */
const FALLBACK_ACCENTS: AccentOption[] = [
  { code: "en-US", label: "American English", tts_voice: "en-US-Neural2-C", rhotic: true, notes: "" },
  { code: "en-GB", label: "British English", tts_voice: "en-GB-Neural2-A", rhotic: false, notes: "" },
  { code: "en-AU", label: "Australian English", tts_voice: "en-AU-Neural2-A", rhotic: false, notes: "" },
  { code: "en-IN", label: "Indian English", tts_voice: "en-IN-Neural2-A", rhotic: true, notes: "" },
];

const FALLBACK_L1: L1Option[] = [
  { code: "other", label: "Other / prefer not to say", weak_phones: [] },
];

/**
 * Process-local cache of the catalog.
 *
 * `/api/dashboard` needs these lists on every render, and without a cache a
 * backend that is down is paid for in full on every one of them: two parallel
 * requests, each running to its timeout, in front of a page that already has a
 * perfectly good fallback. A successful read is held for a long while (the
 * lists are static), a failed one only briefly, so a backend that comes back is
 * picked up without a redeploy.
 */
let catalogCache: {
  at: number;
  value: SettingsCatalog;
  complete: boolean;
} | null = null;

const CATALOG_TTL_MS = 30 * 60_000;
const CATALOG_FAILURE_TTL_MS = 30_000;

export async function loadSettingsCatalog(): Promise<SettingsCatalog> {
  const cached = catalogCache;
  if (cached) {
    const ttl = cached.complete ? CATALOG_TTL_MS : CATALOG_FAILURE_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
  }

  const [accents, l1Profiles] = await Promise.all([
    fetchPracticeCatalog<{ accents: AccentOption[] }>("/api/practice/accents"),
    fetchPracticeCatalog<{ profiles: L1Option[] }>("/api/practice/l1-profiles"),
  ]);

  const value: SettingsCatalog = {
    accents: accents?.accents?.length ? accents.accents : FALLBACK_ACCENTS,
    l1Profiles: l1Profiles?.profiles?.length ? l1Profiles.profiles : FALLBACK_L1,
  };

  catalogCache = {
    at: Date.now(),
    value,
    // A half-answer (one list served, the other not) is retried like a failure
    // rather than pinned for half an hour.
    complete: Boolean(accents?.accents?.length && l1Profiles?.profiles?.length),
  };

  return value;
}
