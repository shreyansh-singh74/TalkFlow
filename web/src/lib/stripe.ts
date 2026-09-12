import "server-only";

import Stripe from "stripe";

/**
 * Stripe wiring, in one place.
 *
 * Billing is *optional*: with no `STRIPE_SECRET_KEY` the app runs entirely on
 * the free tier and the upgrade buttons explain that billing is not configured,
 * instead of throwing on every dashboard render. That keeps a fresh clone
 * (and CI) working with no secrets, which is the only way a reviewer will
 * actually run the thing.
 */

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

export function isBillingConfigured(): boolean {
  return Boolean(stripe && PRO_PRICE_ID);
}

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return stripe;
}

/** Where Stripe sends the learner back to, and where the webhook is mounted. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * A subscription's paid-through date.
 *
 * Stripe moved `current_period_end` off the subscription and onto its items
 * (2025 API versions); both shapes are read so the app keeps working across an
 * SDK/API-version bump instead of silently treating every subscription as
 * expired, which would downgrade paying learners to the free tier.
 */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const legacy = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const seconds = legacy ?? fromItem;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/** Subscription states that mean "this learner is paying right now". */
export function isActiveStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}
