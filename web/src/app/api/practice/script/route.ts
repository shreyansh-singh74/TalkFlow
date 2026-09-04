import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend-config";

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
    const response = await fetch(`${getBackendUrl()}/api/practice/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
