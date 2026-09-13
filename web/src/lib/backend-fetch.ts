import "server-only";

import { getBackendHeaders, getBackendUrl } from "@/lib/backend-config";
import type { PracticeScript, ScriptRequest } from "@/types/practice";

/**
 * Server-side calls to the practice service, with the failure reported honestly.
 *
 * This exists because one message -- "Is the backend running?" -- used to stand
 * in for four different problems: the URL was never configured, the host did not
 * answer, it answered too late, or it answered with an error. All four looked
 * identical to the learner, and none of them pointed at anything to fix, so a
 * deployment whose `NEXT_PUBLIC_BACKEND_URL` pointed at the developer's own
 * machine produced the same sentence as a backend that was simply switched off.
 *
 * Every failure now carries what actually happened, is logged with the URL that
 * was dialled, and reaches the caller as a message that names the problem.
 */

/**
 * Budget for a script request, in milliseconds.
 *
 * The backend's contract is that script generation never fails: it validates the
 * model's output against the difficulty band and tops up from a fallback bank,
 * so it *always* answers 200. A request still unanswered after 20s is therefore
 * not going to answer usefully, and the old 45s budget meant a form submit could
 * sit on a spinner for three quarters of a minute before reporting a failure the
 * learner could do nothing about. Measured generation against a warm backend is
 * ~40ms, and ~3s when the model call itself has to fall back.
 */
export const PRACTICE_TIMEOUT_MS = 20_000;

/**
 * Reference lists (accents, L1 profiles) are three static arrays served from the
 * same process as script generation, so they get a much smaller budget: they are
 * a nice-to-have on a page that must render regardless, and making a learner wait
 * five seconds for a fallback list is worse than using the fallback immediately.
 */
export const CATALOG_TIMEOUT_MS = 2_500;

export type BackendFailureReason =
  /** BACKEND_URL / NEXT_PUBLIC_BACKEND_URL is not set on the server. */
  | "not-configured"
  /** The request was still in flight when the budget ran out. */
  | "timeout"
  /** DNS, connection refused, TLS, or a dropped packet. */
  | "unreachable"
  /** The service answered -- with a non-2xx status. */
  | "rejected";

export interface BackendFailure {
  reason: BackendFailureReason;
  /** The address we dialled, so the report says *what* was unreachable. */
  url?: string;
  /** HTTP status, when the service answered at all. */
  status?: number;
  /** Fetch error code (`ECONNREFUSED`, `ENOTFOUND`) or the upstream body. */
  detail?: string;
  /** The budget that expired, when `reason` is "timeout". */
  timeoutMs?: number;
}

export type BackendResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: BackendFailure };

/**
 * Dig an OS-level error code out of a failed fetch.
 *
 * Node wraps the real network error: `fetch failed` carries the socket error as
 * a cause, and with happy-eyeballs that cause is an `AggregateError` whose
 * members hold the code. Without this the report says only "TypeError", which
 * is the one string that helps nobody.
 */
function errorCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== "object" || depth > 4) return undefined;
  const candidate = error as {
    code?: unknown;
    errors?: unknown[];
    cause?: unknown;
  };
  // A DOMException's `code` is a number (23 === TIMEOUT_ERR). The codes worth
  // reporting are the string ones, and a timeout already says so in `reason`.
  if (typeof candidate.code === "string") return candidate.code;
  if (Array.isArray(candidate.errors)) {
    for (const nested of candidate.errors) {
      const code = errorCode(nested, depth + 1);
      if (code) return code;
    }
  }
  return errorCode(candidate.cause, depth + 1);
}

function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  // `AbortSignal.timeout` rejects with TimeoutError; an aborted connect that
  // predates the signal's own error surfaces as AbortError.
  return name === "TimeoutError" || name === "AbortError";
}

/** Keep an upstream error body short enough to put in front of an operator. */
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const text = (await response.text()).trim();
    return text ? text.slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One sentence, operator-facing, that says what to check.
 *
 * These surface in a toast, so they stay short -- but they are deliberately
 * specific. "Is the backend running?" is the one thing the caller already
 * checked.
 */
export function backendFailureMessage(
  failure: BackendFailure,
  what = "the practice script"
): string {
  switch (failure.reason) {
    case "not-configured":
      return `Could not build ${what}: no practice service is configured on this server. Set BACKEND_URL (or NEXT_PUBLIC_BACKEND_URL).`;
    case "timeout":
      return `Could not build ${what}: the practice service at ${
        failure.url ?? "its configured address"
      } did not answer within ${(failure.timeoutMs ?? PRACTICE_TIMEOUT_MS) / 1000}s.`;
    case "unreachable":
      return `Could not reach the practice service at ${failure.url}${
        failure.detail ? ` (${failure.detail})` : ""
      }.`;
    case "rejected":
      if (failure.status === 401 || failure.status === 403) {
        return `The practice service refused the request (HTTP ${failure.status}). Check that INTERNAL_API_TOKEN matches on both sides.`;
      }
      return `The practice service returned HTTP ${failure.status}${
        failure.detail ? `: ${failure.detail}` : ""
      }.`;
  }
}

/** POST a script request to the practice service. Never throws. */
export async function generatePracticeScript(
  body: ScriptRequest,
  timeoutMs = PRACTICE_TIMEOUT_MS
): Promise<BackendResult<PracticeScript>> {
  let url: string;
  try {
    url = getBackendUrl();
  } catch {
    const failure: BackendFailure = { reason: "not-configured" };
    console.error("Practice service is not configured:", failure);
    return { ok: false, failure };
  }

  try {
    const response = await fetch(`${url}/api/practice/script`, {
      method: "POST",
      headers: getBackendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const failure: BackendFailure = {
        reason: "rejected",
        url,
        status: response.status,
        detail: await readDetail(response),
      };
      console.error("Practice service rejected the script request:", failure);
      return { ok: false, failure };
    }

    return { ok: true, data: (await response.json()) as PracticeScript };
  } catch (error) {
    const timedOut = isTimeout(error);
    const failure: BackendFailure = {
      reason: timedOut ? "timeout" : "unreachable",
      url,
      detail: errorCode(error),
      ...(timedOut ? { timeoutMs } : {}),
    };
    console.error(
      "Practice service call failed:",
      failure,
      error instanceof Error ? error.message : error
    );
    return { ok: false, failure };
  }
}

/**
 * GET a reference list from the practice service. Never throws.
 *
 * `cache: "force-cache"` is deliberate for these: the accents and L1 profiles
 * are static reference data with no learner content in them.
 */
export async function fetchPracticeCatalog<T>(
  path: string,
  timeoutMs = CATALOG_TIMEOUT_MS
): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendUrl()}${path}`, {
      headers: getBackendHeaders(),
      cache: "force-cache",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // The callers all have a literal fallback and it is not worth logging the
    // same unreachable backend on every dashboard render.
    return null;
  }
}
