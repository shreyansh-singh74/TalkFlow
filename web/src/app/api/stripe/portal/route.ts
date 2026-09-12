import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { appUrl, isBillingConfigured, requireStripe } from "@/lib/stripe";

/**
 * The Stripe-hosted billing portal: cancel, change card, download invoices.
 *
 * Deliberately not reimplemented here. Cancelling a subscription correctly
 * (at period end vs immediately, proration, failed-payment dunning) is a lot of
 * behaviour to get wrong, and Stripe already exposes the audited version.
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
    if (!settings.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet. Upgrade first." },
        { status: 409 }
      );
    }

    const portal = await requireStripe().billingPortal.sessions.create({
      customer: settings.stripeCustomerId,
      return_url: `${appUrl()}/settings`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Stripe portal failed:", error);
    return NextResponse.json(
      { error: "Could not open the billing portal. Please try again." },
      { status: 500 }
    );
  }
}
