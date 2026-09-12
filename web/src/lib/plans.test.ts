import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_MONTHLY_SESSIONS,
  RENEWAL_GRACE_MS,
  effectivePlan,
  monthStart,
  quotaMessage,
  type PlanState,
} from "./plans";

/**
 * The plan rules are the part of billing a user can be *wronged* by: a paying
 * learner silently downgraded to the free cap, or a cancelled subscription that
 * keeps granting unlimited practice. Both directions are pinned here.
 */

const NOW = new Date("2026-09-12T10:00:00Z");

function state(overrides: Partial<PlanState> = {}): PlanState {
  return {
    plan: "free",
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    ...overrides,
  };
}

test("a free row is free", () => {
  assert.equal(effectivePlan(state(), NOW), "free");
});

test("pro with a live subscription is pro", () => {
  const pro = state({
    plan: "pro",
    stripeSubscriptionId: "sub_123",
    currentPeriodEnd: new Date("2026-10-12T00:00:00Z"),
  });
  assert.equal(effectivePlan(pro, NOW), "pro");
});

test("plan=pro without a subscription id is not pro", () => {
  // A hand-edited or half-written row must not grant unlimited practice.
  const fake = state({ plan: "pro", currentPeriodEnd: new Date("2026-10-12T00:00:00Z") });
  assert.equal(effectivePlan(fake, NOW), "free");
});

test("an expired period falls back to free once the grace window closes", () => {
  const lapsed = state({
    plan: "pro",
    stripeSubscriptionId: "sub_123",
    currentPeriodEnd: new Date(NOW.getTime() - RENEWAL_GRACE_MS - 1000),
  });
  assert.equal(effectivePlan(lapsed, NOW), "free");
});

test("a subscription inside its grace window stays pro", () => {
  // Stripe renews at period end; the webhook can land minutes later.
  const renewing = state({
    plan: "pro",
    stripeSubscriptionId: "sub_123",
    currentPeriodEnd: new Date(NOW.getTime() - 60_000),
  });
  assert.equal(effectivePlan(renewing, NOW), "pro");
});

test("a pro subscription with no period end is trusted", () => {
  // Some subscription shapes do not expose a period end; an active status is
  // then the only signal, and refusing it would break real paying accounts.
  const active = state({ plan: "pro", stripeSubscriptionId: "sub_123" });
  assert.equal(effectivePlan(active, NOW), "pro");
});

test("the quota month starts at midnight UTC on the 1st", () => {
  assert.equal(monthStart(NOW).toISOString(), "2026-09-01T00:00:00.000Z");
  // A late-evening local time must not roll the month early or late.
  const late = new Date("2026-09-30T23:59:59Z");
  assert.equal(monthStart(late).toISOString(), "2026-09-01T00:00:00.000Z");
  const early = new Date("2026-10-01T00:00:01Z");
  assert.equal(monthStart(early).toISOString(), "2026-10-01T00:00:00.000Z");
});

test("the blocked message names the real limit", () => {
  const message = quotaMessage(FREE_MONTHLY_SESSIONS);
  assert.match(message, /10 free sessions/);
});
