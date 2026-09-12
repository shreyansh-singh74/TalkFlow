declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};


interface WindowWithBackendLog extends Window {
  __backendUrlLogged?: boolean;
}

let backendUrlCache: string | null = null;

export function getBackendUrl(): string {
  if (backendUrlCache) {
    return backendUrlCache;
  }

  const configuredUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined;
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const url = (configuredUrl || (isLocalhost ? 'http://localhost:8000' : '')).replace(/\/$/, '');

  if (!url) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is not set');
  }

  backendUrlCache = url;
  if (typeof window !== 'undefined' && !(window as WindowWithBackendLog).__backendUrlLogged) {
    console.info("Backend URL configured", { backendUrl: url });
    (window as WindowWithBackendLog).__backendUrlLogged = true;
  }

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
