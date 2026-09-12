import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackendHeaders, getBackendUrl } from "@/lib/backend-config";
import { getUserSettings } from "@/lib/settings";

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

  try {
    const body = await request.json();
    // The preview must promise the same script the session will get, so it is
    // generated with the same accent and L1 the create path uses.
    const userPrefs = await getUserSettings(session.user.id);
    const response = await fetch(`${getBackendUrl()}/api/practice/script`, {
      method: "POST",
      headers: getBackendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        l1: userPrefs.nativeLanguage || undefined,
        ...body,
        // An explicit accent from the form (a coach being previewed) wins.
        accent: body?.accent || userPrefs.targetAccent,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not build a practice script" },
        { status: 502 }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Script preview failed:", error);
    return NextResponse.json(
      { error: "Practice service unreachable. Is the backend running?" },
      { status: 502 }
    );
  }
}
