import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { getBackendHeaders, getBackendUrl } from "@/lib/backend-config";
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

export async function loadSettingsCatalog(): Promise<SettingsCatalog> {
  const [accents, l1Profiles] = await Promise.all([
    fetchCatalog<{ accents: AccentOption[] }>("/api/practice/accents"),
    fetchCatalog<{ profiles: L1Option[] }>("/api/practice/l1-profiles"),
  ]);

  return {
    accents: accents?.accents?.length ? accents.accents : FALLBACK_ACCENTS,
    l1Profiles: l1Profiles?.profiles?.length ? l1Profiles.profiles : FALLBACK_L1,
  };
}

async function fetchCatalog<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendUrl()}${path}`, {
      headers: getBackendHeaders(),
      // A reference list, not learner data: cache it for the process lifetime.
      cache: "force-cache",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
