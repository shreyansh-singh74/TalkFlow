/**
 * Plan rules, with no database and no server-only imports.
 *
 * Kept separate from `billing.ts` so the rules can be unit-tested directly
 * (`plans.test.ts`) instead of only through a query. The interesting logic here
 * is all about *not* granting Pro: a plan row is not proof of payment, only a
 * live subscription inside its paid period is.
 */

export const FREE_MONTHLY_SESSIONS = 10;

/** Renewal grace, so a paying learner is never cut off mid-renewal. */
export const RENEWAL_GRACE_MS = 24 * 60 * 60 * 1000;

export type PlanId = "free" | "pro";

/** The plan-bearing fields, structural so both a settings row and a test literal fit. */
export type PlanState = {
  plan: PlanId;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
};

export function monthStart(now: Date = new Date()): Date {
  // UTC on purpose: the quota must not depend on the server's timezone, or two
  // learners get different allowances from the same deployment.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The plan actually in force right now.
 *
 * `plan = "pro"` alone is not enough: a subscription Stripe stopped billing for
 * (card removed, subscription deleted while a webhook went undelivered) must not
 * keep granting unlimited practice. So a pro row also has to name a live
 * subscription and be inside its paid period, with a day of grace for the
 * renewal webhook to land.
 */
export function effectivePlan(state: PlanState, now: Date = new Date()): PlanId {
  if (state.plan !== "pro" || !state.stripeSubscriptionId) return "free";
  if (
    state.currentPeriodEnd &&
    state.currentPeriodEnd.getTime() + RENEWAL_GRACE_MS < now.getTime()
  ) {
    return "free";
  }
  return "pro";
}

/** The message a blocked learner sees, in one place so both gates agree. */
export function quotaMessage(limit: number | null): string {
  return (
    `You've used all ${limit} free sessions this month. ` +
    "Upgrade to Pro for unlimited practice, or wait until the 1st."
  );
}
