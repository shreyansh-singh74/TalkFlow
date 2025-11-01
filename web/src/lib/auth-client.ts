import { createAuthClient } from "better-auth/react"

// Better Auth automatically detects the base URL in production
// In development, it defaults to localhost:3000
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" 
    ? `${window.location.origin}/api/auth`
    : "http://localhost:3000/api/auth"
}) 