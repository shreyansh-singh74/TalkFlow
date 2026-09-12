/**
 * Fetch a short-lived voice token for a practice session.
 *
 * Returns `null` rather than throwing when the token cannot be obtained, so the
 * caller connects without one. That is deliberate: a developer running the
 * backend with `WS_AUTH_REQUIRED=0` has no secret configured, and the backend —
 * not this function — is the thing that decides whether an anonymous socket is
 * acceptable.
 */
export async function fetchVoiceToken(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;

  try {
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/ws-token`,
      { method: "POST" }
    );
    if (!response.ok) {
      if (response.status !== 503) {
        console.warn("[voice-token] request failed", response.status);
      }
      return null;
    }
    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch (error) {
    console.warn("[voice-token] unreachable", error);
    return null;
  }
}
