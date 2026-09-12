import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getBackendHeaders, getBackendUrl } from "@/lib/backend-config";
import { getUserSettings } from "@/lib/settings";
import { upsertSoundGoal } from "@/lib/sound-goals";
import type { PracticeScript } from "@/types/practice";

/**
 * Build a drill aimed at one sound and open a session for it.
 *
 * This is the step the product was missing: the reports have always ended with
 * "drill /ð/", and the button next to that sentence went to the sessions list.
 * A drill is a normal practice session whose script was generated for a single
 * phone, so everything downstream — the voice engine, the scorer, the report —
 * works unchanged, and the phone is recorded on the session so the queue can
 * grade the result.
 */

const drillSchema = z.object({
  phone: z.string().min(1).max(8),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  stepCount: z.number().int().min(3).max(20).default(8),
});

/** The generator prompt is topic-driven; this is the topic. */
function drillTopic(phone: string): string {
  return (
    `Minimal pairs and everyday words built around the /${phone}/ sound, ` +
    `contrasted with the sounds learners most often substitute for it`
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, difficulty, stepCount } = drillSchema.parse(body);
    const userId = session.user.id;

    // The script the whole session runs on, generated and band-validated by the
    // backend. `focus_sounds` is what steers it at this phone.
    let script: PracticeScript | null = null;
    try {
      const userPrefs = await getUserSettings(userId);
      const response = await fetch(`${getBackendUrl()}/api/practice/script`, {
        method: "POST",
        headers: getBackendHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          source: "coach",
          difficulty,
          step_count: stepCount,
          topic: drillTopic(phone),
          coach_name: `/${phone}/ drill`,
          focus_sounds: [phone],
          accent: userPrefs.targetAccent,
          l1: userPrefs.nativeLanguage || undefined,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok) {
        script = (await response.json()) as PracticeScript;
      }
    } catch (error) {
      console.error("Drill script unreachable:", error);
    }

    if (!script) {
      return NextResponse.json(
        { error: "Could not build the drill. Is the backend running?" },
        { status: 502 }
      );
    }

    const [created] = await db
      .insert(practiceSessions)
      .values({
        name: `Drill: /${phone}/`,
        userId,
        // No coach row: the drill's identity is the phone, and the script
        // carries its own label. A fabricated coach would be one more thing to
        // keep in sync.
        coachId: null,
        source: "coach",
        difficulty,
        script,
        drillPhone: phone,
      })
      .returning();

    // Serving the drill advances the queue's interval. The outcome is folded in
    // later, when the session is saved with its report.
    await upsertSoundGoal(userId, phone, { served: true });

    return NextResponse.json({ id: created.id, script, phone });
  } catch (error) {
    console.error("Drill error:", error);
    return NextResponse.json(
      { error: "Failed to create the drill" },
      { status: 500 }
    );
  }
}
