import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { stripeEvents, userSettings } from "@/db/schema";
import { isActiveStatus, requireStripe, subscriptionPeriodEnd } from "@/lib/stripe";

/**
 * Stripe webhook: the only writer of plan state.
 *
 * The rules this encodes, all of which are easy to get wrong:
 *
 * * **Verify the signature** against the raw body. A webhook endpoint that
 *   trusts its body is an endpoint that grants anybody Pro for free.
 * * **Be idempotent.** Stripe retries on any non-2xx, so `event.id` is recorded
 *   first and a replay is acknowledged without being re-applied.
 * * **Fail loudly.** If applying an event throws, the dedupe row is removed and
 *   a 500 is returned, so Stripe retries rather than the learner silently
 *   keeping (or losing) a plan.
 * * **Never trust the event alone.** The subscription is re-read from the API,
 *   because a webhook payload can arrive out of order and an older event must
 *   not overwrite newer state.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await requireStripe().webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Claim the event before acting on it. A conflict means we have already
  // applied this one, so acknowledge and stop.
  const [claimed] = await db
    .insert(stripeEvents)
    .values({ eventId: event.id, eventType: event.type })
    .onConflictDoNothing({ target: stripeEvents.eventId })
    .returning();

  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await applyEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Release the claim so Stripe's retry can attempt the work again.
    await db.delete(stripeEvents).where(eq(stripeEvents.eventId, event.id));
    console.error(`Stripe event ${event.id} (${event.type}) failed:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function applyEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const checkout = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof checkout.subscription === "string"
          ? checkout.subscription
          : checkout.subscription?.id;
      if (!subscriptionId) return; // one-off payment; nothing to provision
      const subscription = await requireStripe().subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription, checkout.client_reference_id ?? undefined);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await updateBySubscription(subscription, {
        plan: "free",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      });
      return;
    }

    case "invoice.payment_failed": {
      // Do NOT downgrade here. Stripe retries the charge, and a learner whose
      // card expired mid-month should finish the month they paid for: the
      // period-end check in lib/billing.ts expires the plan on its own.
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("Stripe invoice payment failed", {
        customer: typeof invoice.customer === "string" ? invoice.customer : undefined,
      });
      return;
    }

    default:
      return;
  }
}

/** Re-read state from the subscription and mirror it onto the settings row. */
async function syncSubscription(
  subscription: Stripe.Subscription,
  userIdHint?: string
): Promise<void> {
  const active = isActiveStatus(subscription.status);
  await updateBySubscription(
    subscription,
    active
      ? {
          plan: "pro",
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: subscriptionPeriodEnd(subscription),
        }
      : {
          plan: "free",
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        },
    userIdHint
  );
}

async function updateBySubscription(
  subscription: Stripe.Subscription,
  values: {
    plan: "free" | "pro";
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
  },
  userIdHint?: string
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const userId = subscription.metadata?.userId || userIdHint;
  const rows = userId
    ? await db
        .update(userSettings)
        .set({ ...values, stripeCustomerId: customerId ?? undefined, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning({ id: userSettings.id })
    : [];

  if (rows.length > 0) return;

  // Fall back to the customer id: a subscription created outside Checkout (in
  // the Stripe dashboard, say) has no metadata of ours on it.
  if (!customerId) return;
  await db
    .update(userSettings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(userSettings.stripeCustomerId, customerId));
}
