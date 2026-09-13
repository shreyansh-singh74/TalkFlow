import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  backendFailureMessage,
  generatePracticeScript,
} from "@/lib/backend-fetch";
import { getUserSettings } from "@/lib/settings";
import type { ScriptRequest } from "@/types/practice";

/**
 * Proxies script generation to the FastAPI backend for the *preview* in the
 * session form, so the browser never needs a backend URL or CORS grant. The
 * authoritative generation still happens in POST /api/sessions at create time.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<ScriptRequest>;
  try {
    body = (await request.json()) as Partial<ScriptRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // The preview must promise the same script the session will get, so it is
  // generated with the same accent and L1 the create path uses.
  const userPrefs = await getUserSettings(session.user.id);

  const result = await generatePracticeScript({
    ...body,
    source: body.source ?? "coach",
    difficulty: body.difficulty ?? "medium",
    l1: userPrefs.nativeLanguage || undefined,
    // An explicit accent from the form (a coach being previewed) wins.
    accent: body.accent || userPrefs.targetAccent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: backendFailureMessage(result.failure) },
      { status: 502 }
    );
  }

  return NextResponse.json(result.data);
}
