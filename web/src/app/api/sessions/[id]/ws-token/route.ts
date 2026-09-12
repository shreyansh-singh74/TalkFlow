import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { db } from "@/db";
import { practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getQuota, quotaMessage } from "@/lib/billing";
import { getUserSettings } from "@/lib/settings";
import { and, eq } from "drizzle-orm";

/**
 * Mint the short-lived token the voice WebSocket authenticates with.
 *
 * Why a token and not a cookie: the browser connects to the FastAPI service on
 * a different origin with `new WebSocket(url)`, which cannot attach the Better
 * Auth session cookie or custom headers. Without this, /ws/voice accepted
 * anonymous sockets — each turn runs two CPU models and spends OpenRouter and
 * Google TTS credit, and the session id the client sent named the folder that
 * turn audio was written to.
 *
 * The token asserts `{v, sub, sid, exp}` and is signed with HMAC-SHA256 over
 * the base64url payload. The backend verifies it in `app/core/ws_auth.py`, and
 * `backend/tests/test_ws_auth.py` pins this exact encoding — so if you change
 * the key order, the separator, or the digest here, change it there too.
 *
 * This is also where the free-tier limit is enforced. Minting the token is the
 * last step before the socket opens, so gating here means the cap cannot be
 * skipped by calling the backend directly, and it cannot be bypassed by an
 * old session row created before the cap was reached.
 */

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 120;

function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership is checked here, against the database, rather than trusting the
    // id in the URL: this signature is what authorises the socket, so it must
    // only ever be minted for a session the caller actually owns.
    const [owned] = await db
      .select({ id: practiceSessions.id })
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.id, id),
          eq(practiceSessions.userId, session.user.id)
        )
      );

    if (!owned) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const settings = await getUserSettings(session.user.id);
    const quota = await getQuota(session.user.id, settings);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quotaMessage(quota.limit), code: "quota_exceeded", quota },
        { status: 402 }
      );
    }

    const secret = process.env.WS_TOKEN_SECRET;
    if (!secret) {
      // Not a 500: the backend may legitimately be running with
      // WS_AUTH_REQUIRED=0 for local development. The client treats a missing
      // token as "connect without one" and the backend decides.
      return NextResponse.json(
        { error: "Voice tokens are not configured on this server" },
        { status: 503 }
      );
    }

    const ttl = Number(process.env.WS_TOKEN_TTL_SECONDS) || DEFAULT_TTL_SECONDS;
    const exp = Math.floor(Date.now() / 1000) + ttl;

    // Key order is alphabetical and must match Python's sort_keys=True.
    const payload = JSON.stringify({
      exp,
      sid: owned.id,
      sub: session.user.id,
      v: TOKEN_VERSION,
    });
    const payloadB64 = b64url(payload);
    const signature = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex");

    return NextResponse.json({
      token: `${payloadB64}.${signature}`,
      expiresIn: ttl,
    });
  } catch (error) {
    console.error("ws-token error:", error);
    return NextResponse.json(
      { error: "Failed to mint a voice token" },
      { status: 500 }
    );
  }
}
