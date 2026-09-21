declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};


let backendUrlCache: string | null = null;

/**
 * The practice service's address.
 *
 * Two callers with two different network positions share this: the browser
 * dials it directly for the voice socket and TTS, and the Next.js server dials
 * it for script generation. In a deployment those two hosts are often not the
 * same address -- the server may reach the backend over a private network while
 * the browser needs the public one -- so a server-only `BACKEND_URL` wins over
 * the public var when it is set. It is deliberately not a NEXT_PUBLIC_* name:
 * the browser bundle must never be handed an internal address.
 */
export function getBackendUrl(): string {
  if (backendUrlCache) {
    return backendUrlCache;
  }

  const serverOnlyUrl =
    typeof window === 'undefined' && typeof process !== 'undefined'
      ? process.env.BACKEND_URL
      : undefined;
  const configuredUrl =
    serverOnlyUrl ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined);
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const raw =
    (configuredUrl || (isLocalhost ? 'http://localhost:8000' : '')).replace(/\/$/, '');
  // Operators often paste the API base with a trailing `/api`
  // (e.g. `https://backend.example.com/api`). The callers already append
  // `/api/...`, so that would dial `/api/api/...` and FastAPI answers 404
  // `{"detail":"Not Found"}`. Strip one trailing `/api` to stay forgiving.
  const url = raw.replace(/\/api$/, '');

  if (!url) {
    throw new Error(
      'No practice service configured: set BACKEND_URL (server) or NEXT_PUBLIC_BACKEND_URL'
    );
  }

  backendUrlCache = url;
  return url;
}

/**
 * Headers for server-to-server backend calls.
 *
 * Script generation spends OpenRouter credit, so the backend guards
 * `/api/practice/*` with a shared secret (see the backend's
 * app/core/internal_auth.py). This is deliberately NOT a NEXT_PUBLIC_* var:
 * the token is a server credential and must never reach the browser.
 */
export function getBackendHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = typeof process !== 'undefined' ? process.env.INTERNAL_API_TOKEN : undefined;
  if (token) {
    headers['X-Internal-Token'] = token;
  }
  return headers;
}

export function getWebSocketUrl(path: string = '/ws/voice'): string {
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}${path}`;
}

export function isUsingLocalhost(): boolean {
  return getBackendUrl().includes('localhost') || getBackendUrl().includes('127.0.0.1');
}
