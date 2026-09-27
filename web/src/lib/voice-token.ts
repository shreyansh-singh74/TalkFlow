/**
 * Fetch a short-lived voice token for a practice session.
 *
 * The result is structured rather than a nullable token because the failure
 * modes need different treatment: a 402 means the learner's free quota is
 * spent and retrying can never succeed (it used to loop through
 * "Reconnecting…" for minutes, hiding the one message that mattered), while
 * everything else is transient. A missing token *is* a success in one case:
 * a deployment without WS_TOKEN_SECRET runs the backend with
 * WS_AUTH_REQUIRED=0, and the backend — not this function — decides whether
 * an anonymous socket is acceptable.
 */
export type VoiceTokenResult =
  | { ok: true; token: string | null }
  | {
      ok: false;
      status: number;
      code?: string;
      message?: string;
    };

export async function fetchVoiceToken(sessionId: string): Promise<VoiceTokenResult> {
  if (!sessionId) return { ok: true, token: null };

  try {
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/ws-token`,
      { method: "POST" }
    );
    if (!response.ok) {
      if (response.status !== 503) {
        console.warn("[voice-token] request failed", response.status);
      }
      if (response.status === 503) {
        // Tokens are not configured on this server; connect anonymously and
        // let the backend's WS_AUTH_REQUIRED decide.
        return { ok: true, token: null };
      }
      let code: string | undefined;
      let message: string | undefined;
      try {
        const body = (await response.json()) as { code?: string; error?: string };
        code = body.code;
        message = body.error;
      } catch {
        // Non-JSON error body — the status still carries the meaning.
      }
      return { ok: false, status: response.status, code, message };
    }
    const data = (await response.json()) as { token?: string };
    return { ok: true, token: data.token ?? null };
  } catch (error) {
    console.warn("[voice-token] unreachable", error);
    return { ok: false, status: 0 };
  }
}

/** True when a token failure means retrying can never succeed. */
export function isQuotaFailure(result: VoiceTokenResult): boolean {
  return !result.ok && (result.status === 402 || result.code === "quota_exceeded");
}
