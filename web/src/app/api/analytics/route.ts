import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { soundGoals } from "@/db/schema";
import { auth } from "@/lib/auth";
import { loadSessionSamples } from "@/lib/session-samples";
import { summarize } from "@/lib/progress";

/**
 * Progress over time: accuracy trend, per-phone evidence, and today's drill.
 *
 * Everything here is derived from what was measured. A field is `null` when the
 * underlying scorer never ran for those sessions, and the page hides it rather
 * than showing a zero — the same rule `generate_session_report` follows on the
 * backend, applied to the product layer.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const samples = await loadSessionSamples(session.user.id);
    const summary = summarize(samples);

    // The queue, ordered the way it should be worked: overdue first, then the
    // phones with the most evidence of being a problem.
    const goals = await db
      .select()
      .from(soundGoals)
      .where(eq(soundGoals.userId, session.user.id))
      .orderBy(asc(soundGoals.nextReviewAt));

    const now = new Date();
    const due = goals.filter((g) => g.nextReviewAt <= now);
    // If nothing is formally due, the weakest phone with enough evidence is
    // still worth offering — an empty drill card is worse than a slightly early
    // review.
    const nextPhone = due[0]?.phone ?? summary.weakPhones[0] ?? null;

    const dueRoute = await db
      .select({ phone: soundGoals.phone })
      .from(soundGoals)
      .where(
        and(
          eq(soundGoals.userId, session.user.id),
          lte(soundGoals.nextReviewAt, now)
        )
      )
      .limit(1);

    return NextResponse.json({
      ...summary,
      drill: nextPhone
        ? {
            phone: nextPhone,
            dueNow: dueRoute.length > 0,
            fromQueue: due.length > 0,
          }
        : null,
      goalQueue: goals.map((g) => ({
        phone: g.phone,
        observations: g.observations,
        errors: g.errors,
        drillCount: g.drillCount,
        lastPractisedAt: g.lastPractisedAt?.toISOString() ?? null,
        nextReviewAt: g.nextReviewAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 }
    );
  }
}
