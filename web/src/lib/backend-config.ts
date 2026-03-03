const RAW_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL || "http://localhost:8000";

const BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, "");

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export function getWebSocketUrl(path: string = "/ws/voice"): string {
  const wsUrl = BACKEND_URL.replace(/^http/, "ws");
  return `${wsUrl}${path}`;
}

export function isUsingLocalhost(): boolean {
  return (
    BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1")
  );
}

