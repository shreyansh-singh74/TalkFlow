import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { effectivePlan } from "@/lib/billing";
import { getUserSettings } from "@/lib/settings";
import { PRO_PRICE_ID, appUrl, isBillingConfigured, requireStripe } from "@/lib/stripe";

/**
 * Start a Pro subscription.
 *
 * Two details that make this safe to retry: the Stripe customer is created once
 * and stored on the settings row (so a learner who opens checkout twice, or on
 * two devices, does not end up with two customers and two subscriptions), and
 * `client_reference_id`/`subscription_data.metadata.userId` carry our user id
 * into Stripe so the webhook can always map an event back to a learner.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 }
    );
  }

  try {
    const settings = await getUserSettings(session.user.id);
    if (effectivePlan(settings) === "pro") {
      return NextResponse.json(
        { error: "You are already on Pro. Use Manage billing to change it." },
        { status: 409 }
      );
    }

    const stripe = requireStripe();

    let customerId = settings.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await db
        .update(userSettings)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(userSettings.userId, session.user.id));
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      client_reference_id: session.user.id,
      subscription_data: { metadata: { userId: session.user.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/settings?checkout=success`,
      cancel_url: `${appUrl()}/settings?checkout=cancelled`,
    });

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout failed:", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
