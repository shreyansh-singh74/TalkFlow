declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

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
  const url = (isLocalhost ? 'http://localhost:8000' : (configuredUrl || '')).replace(/\/$/, '');

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

export function getWebSocketUrl(path: string = '/ws/voice'): string {
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}${path}`;
}

export function isUsingLocalhost(): boolean {
  return getBackendUrl().includes('localhost') || getBackendUrl().includes('127.0.0.1');
}
