/**
 * Backend URL Configuration
 * Manages switching between localhost and production backend
 */

// Type declaration for process.env (Next.js provides this at build time)
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

// Type-safe environment variable accessor
function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

// Extend Window interface to include our custom property
interface WindowWithBackendLog extends Window {
  __backendUrlLogged?: boolean;
}

/**
 * Get the backend URL based on environment configuration
 * Controlled by NEXT_PUBLIC_USE_LOCALHOST env variable
 */
export function getBackendUrl(): string {
  // Check if we should use localhost
  const useLocalhost = getEnv('NEXT_PUBLIC_USE_LOCALHOST') === 'true';
  
  // Get URLs from environment variables
  // Localhost fallback is safe as it's only for development
  const localhostUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_LOCAL') || 'http://localhost:8000';
  
  // Production URL must be set in environment variables
  // No hardcoded fallback to prevent using wrong backend
  const productionUrl = getEnv('NEXT_PUBLIC_BACKEND_URL_PROD');
  
  // During build time (SSG), return a placeholder to prevent build errors
  // The actual URL will be resolved at runtime in the browser
  const isBuildTime = typeof window === 'undefined';
  
  if (isBuildTime) {
    // Return a placeholder during build - this won't be used, just prevents build errors
    return productionUrl || localhostUrl || 'http://localhost:8000';
  }
  
  // At runtime, throw error if production URL is missing (only in browser)
  if (!useLocalhost && !productionUrl) {
    throw new Error(
      'NEXT_PUBLIC_BACKEND_URL_PROD environment variable is not set. ' +
      'Please set it in your Vercel environment variables or .env.local file.'
    );
  }
  
  // Remove trailing slashes
  const normalizedLocalhost = localhostUrl.replace(/\/$/, '');
  const normalizedProduction = productionUrl?.replace(/\/$/, '') || '';
  
  const selectedUrl = useLocalhost ? normalizedLocalhost : normalizedProduction;
  
  // Log which backend is being used (only in browser, only once)
  if (typeof window !== 'undefined' && !(window as WindowWithBackendLog).__backendUrlLogged) {
    console.log(`🔗 Backend URL: ${selectedUrl} ${useLocalhost ? '(localhost)' : '(production)'}`);
    (window as WindowWithBackendLog).__backendUrlLogged = true;
  }
  
  return selectedUrl;
}

/**
 * Get WebSocket URL from backend URL
 * Converts http:// to ws:// and https:// to wss://
 */
export function getWebSocketUrl(path: string = '/ws/voice'): string {
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}${path}`;
}

/**
 * Check if using localhost backend
 */
export function isUsingLocalhost(): boolean {
  return getEnv('NEXT_PUBLIC_USE_LOCALHOST') === 'true';
}

