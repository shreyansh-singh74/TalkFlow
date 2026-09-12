import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getQuota } from "@/lib/billing";
import { getUserSettings, updateUserSettings } from "@/lib/settings";

/**
 * The learner's own settings.
 *
 * PATCH is deliberately a whitelist of editable fields rather than a spread of
 * the request body: `plan`, the Stripe ids and `onboardedAt` are all on the same
 * row, and a spread would let a learner grant themselves Pro with one request.
 */
const patchSchema = z
  .object({
    displayName: z.string().max(80).optional(),
    nativeLanguage: z.string().max(16).optional(),
    targetAccent: z.string().max(16).optional(),
    ttsVoice: z.string().max(64).optional(),
    ttsRate: z.number().min(0.5).max(2).optional(),
    retainAudio: z.boolean().optional(),
    practiceGoal: z.string().max(280).optional(),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    onboarded: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getUserSettings(session.user.id);
    const quota = await getQuota(session.user.id, settings);
    return NextResponse.json({ settings, quota });
  } catch (error) {
    console.error("Failed to read settings:", error);
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const patch = patchSchema.parse(body);
    const settings = await updateUserSettings(session.user.id, patch);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    }
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
