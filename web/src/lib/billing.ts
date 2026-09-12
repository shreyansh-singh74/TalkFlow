import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { practiceSessions } from "@/db/schema";
import {
  FREE_MONTHLY_SESSIONS,
  effectivePlan,
  monthStart,
  quotaMessage,
  type PlanId,
} from "@/lib/plans";
import type { QuotaState, UserSettings } from "@/types/settings";

/**
 * Plan enforcement, backed by the sessions table.
 *
 * Usage is counted from `practice_sessions` rows rather than a separate
 * `usage_events` counter, on purpose: the rows *are* the usage, so the number
 * the learner is shown and the number the gate enforces cannot drift apart, and
 * there is no second write path that can fail silently and hand out free
 * practice. Stripe remains the record of payments; this is the record of work.
 *
 * The pure rules (what a plan means, when a month starts) live in `plans.ts`.
 */

export { FREE_MONTHLY_SESSIONS, effectivePlan, monthStart, quotaMessage };
export type { PlanId };

type PlanFields = Pick<
  UserSettings,
  "plan" | "stripeSubscriptionId" | "currentPeriodEnd"
>;

export async function monthlySessionCount(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.userId, userId),
        gte(practiceSessions.createdAt, monthStart(now))
      )
    );
  return row?.value ?? 0;
}

export async function getQuota(
  userId: string,
  settings: PlanFields,
  now: Date = new Date()
): Promise<QuotaState> {
  const plan = effectivePlan(settings, now);
  const used = await monthlySessionCount(userId, now);
  const periodStart = monthStart(now).toISOString();

  if (plan === "pro") {
    return { plan, used, limit: null, remaining: null, allowed: true, periodStart };
  }

  const remaining = Math.max(0, FREE_MONTHLY_SESSIONS - used);
  return {
    plan,
    used,
    limit: FREE_MONTHLY_SESSIONS,
    remaining,
    allowed: remaining > 0,
    periodStart,
  };
}
