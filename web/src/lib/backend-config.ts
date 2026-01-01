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
  __backendUrlCache?: string;
}

let backendUrlCache: string | null = null;

export function getBackendUrl(): string {
  if (typeof window === 'undefined') {
    const productionUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_PROD');
    const localhostUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_LOCAL') || 'http://localhost:8000';
    return (productionUrl || localhostUrl).replace(/\/$/, '');
  }

  if (backendUrlCache) {
    return backendUrlCache;
  }

  const useLocalhost = 
    getEnv('NEXT_PUBLIC_USE_LOCALHOST') === 'true' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const envLocalhostUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_LOCAL') || 'http://localhost:8000';
  if (useLocalhost) {
    const url = envLocalhostUrl.replace(/\/$/, '');
    backendUrlCache = url;
    return url;
  }

  const envProductionUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_PROD');
  if (envProductionUrl) {
    const url = envProductionUrl.replace(/\/$/, '');
    backendUrlCache = url;
    if (!(window as WindowWithBackendLog).__backendUrlLogged) {
      console.log(`Backend URL: ${url} (production, from env)`);
      (window as WindowWithBackendLog).__backendUrlLogged = true;
    }
    return url;
  }

  if (!(window as WindowWithBackendLog).__backendUrlCache) {
    (window as WindowWithBackendLog).__backendUrlCache = 'fetching';
    
    fetch('/api/config')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch config from API');
        }
        return response.json();
      })
      .then(config => {
        if (config?.backendUrl) {
          const url = config.backendUrl.replace(/\/$/, '');
          backendUrlCache = url;
          if (!(window as WindowWithBackendLog).__backendUrlLogged) {
            console.log(`Backend URL: ${url} (from runtime config API)`);
            (window as WindowWithBackendLog).__backendUrlLogged = true;
          }
        } else if (config?.error) {
          console.error(`Error: ${config.error}`);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch backend URL from runtime config API:', error);
      });
    
    throw new Error(
      'NEXT_PUBLIC_BACKEND_URL_PROD is not set. ' +
      'Please set it in Vercel environment variables with "All Environments" scope.'
    );
  }
  
  return backendUrlCache || '';
}

export function getWebSocketUrl(path: string = '/ws/voice'): string {
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}${path}`;
}

export function isUsingLocalhost(): boolean {
  return getEnv('NEXT_PUBLIC_USE_LOCALHOST') === 'true';
}

