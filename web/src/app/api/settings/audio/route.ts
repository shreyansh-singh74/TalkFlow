import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getBackendHeaders, getBackendUrl } from "@/lib/backend-config";

/**
 * "Delete my stored audio."
 *
 * The session ids are resolved here, from the authenticated user's own rows, and
 * never taken from the request body: the backend's purge endpoint is internal
 * and trusts its caller, so the ownership check has to happen on this side of
 * the boundary. Consent that cannot be withdrawn is not consent.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({ id: practiceSessions.id })
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, session.user.id));

    if (rows.length === 0) {
      return NextResponse.json({ deleted: 0, sessions: 0 });
    }

    const response = await fetch(`${getBackendUrl()}/api/practice/audio/purge`, {
      method: "POST",
      headers: getBackendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ session_ids: rows.map((row) => row.id) }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The practice service could not delete stored audio." },
        { status: 502 }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Audio purge failed:", error);
    return NextResponse.json(
      { error: "Practice service unreachable" },
      { status: 502 }
    );
  }
}
