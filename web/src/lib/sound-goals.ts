import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { soundGoals } from "@/db/schema";
import type { SessionAnalysisReport } from "@/types/pronunciation";

/**
 * The drill queue's scheduling, kept in one place.
 *
 * A phone enters the queue when it shows up as a weakness, and comes back on an
 * interval that grows while the learner keeps getting it right. Simple on
 * purpose: an SRS whose schedule you cannot explain in a sentence is a schedule
 * nobody trusts.
 */

/** Days until the first review, then doubling, capped. */
const INTERVALS_DAYS = [1, 2, 4, 8, 16, 30];
/** A phone missed at or above this rate stays due immediately. */
const STILL_WRONG_RATE = 0.25;
/** Observations needed before a phone is allowed into the queue at all. */
export const MIN_OBSERVATIONS_FOR_GOAL = 3;

function nextIntervalDays(drillCount: number, stillWrong: boolean): number {
  if (stillWrong) return INTERVALS_DAYS[0];
  const index = Math.min(Math.max(drillCount, 1), INTERVALS_DAYS.length - 1);
  return INTERVALS_DAYS[index];
}

export function nextReviewDate(
  drillCount: number,
  stillWrong: boolean,
  now: Date = new Date()
): Date {
  const days = nextIntervalDays(drillCount, stillWrong);
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Add or refresh a queue entry for one phone.
 *
 * Counters accumulate rather than replace, so the queue keeps its own history
 * of how often a sound has been a problem.
 */
export async function upsertSoundGoal(
  userId: string,
  phone: string,
  options: {
    observations?: number;
    errors?: number;
    /** True when this call marks a drill as actually served. */
    served?: boolean;
    stillWrong?: boolean;
  } = {}
): Promise<void> {
  const clean = phone.trim();
  if (!clean) return;

  const { observations = 0, errors = 0, served = false, stillWrong = false } =
    options;

  const [existing] = await db
    .select()
    .from(soundGoals)
    .where(and(eq(soundGoals.userId, userId), eq(soundGoals.phone, clean)));

  if (!existing) {
    await db.insert(soundGoals).values({
      userId,
      phone: clean,
      observations,
      errors,
      drillCount: served ? 1 : 0,
      lastPractisedAt: served ? new Date() : null,
      nextReviewAt: nextReviewDate(served ? 1 : 0, stillWrong),
    });
    return;
  }

  const drillCount = existing.drillCount + (served ? 1 : 0);

  await db
    .update(soundGoals)
    .set({
      observations: existing.observations + observations,
      errors: existing.errors + errors,
      drillCount,
      lastPractisedAt: served ? new Date() : existing.lastPractisedAt,
      nextReviewAt: nextReviewDate(drillCount, stillWrong),
      updatedAt: new Date(),
    })
    .where(and(eq(soundGoals.userId, userId), eq(soundGoals.phone, clean)));
}

/**
 * Fold a finished session's per-phone evidence into the queue.
 *
 * Called when a session is saved. Only phones the report actually measured are
 * touched — a session scored by the text proxy produces no per-phone data and
 * must not move the schedule.
 */
export async function recordPhoneOutcomes(
  userId: string,
  report: SessionAnalysisReport | null | undefined
): Promise<void> {
  const breakdown = report?.phone_breakdown ?? [];
  if (breakdown.length === 0) return;

  for (const item of breakdown) {
    const phone = (item.phone || "").trim();
    if (!phone || (item.observations ?? 0) < MIN_OBSERVATIONS_FOR_GOAL) continue;

    const stillWrong = (item.error_rate ?? 0) >= STILL_WRONG_RATE;
    await upsertSoundGoal(userId, phone, {
      observations: item.observations ?? 0,
      errors: Math.round((item.error_rate ?? 0) * (item.observations ?? 0)),
      stillWrong,
    });
  }
}

/** Phones currently due, soonest first. */
export async function dueSoundGoals(userId: string, limit = 10) {
  return db
    .select()
    .from(soundGoals)
    .where(
      and(
        eq(soundGoals.userId, userId),
        sql`${soundGoals.nextReviewAt} <= now()`
      )
    )
    .orderBy(soundGoals.nextReviewAt)
    .limit(limit);
}
