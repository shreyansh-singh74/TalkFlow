/**
 * Backend URL Configuration
 * Manages switching between localhost and production backend
 */

/**
 * Get the backend URL based on environment configuration
 * Controlled by NEXT_PUBLIC_USE_LOCALHOST env variable
 */
export function getBackendUrl(): string {
  // Check if we should use localhost
  const useLocalhost = process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
  
  // Get URLs from environment variables
  const localhostUrl = process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL || 'http://localhost:8000';
  const productionUrl = process.env.NEXT_PUBLIC_BACKEND_URL_PROD || 'https://harmonious-heart-production.up.railway.app';
  
  // Remove trailing slashes
  const normalizedLocalhost = localhostUrl.replace(/\/$/, '');
  const normalizedProduction = productionUrl.replace(/\/$/, '');
  
  const selectedUrl = useLocalhost ? normalizedLocalhost : normalizedProduction;
  
  // Log which backend is being used (only in browser, only once)
  if (typeof window !== 'undefined' && !(window as any).__backendUrlLogged) {
    console.log(`🔗 Backend URL: ${selectedUrl} ${useLocalhost ? '(localhost)' : '(production)'}`);
    (window as any).__backendUrlLogged = true;
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
  return process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
}

