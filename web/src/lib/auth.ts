import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Normalize baseURL - remove trailing slash and /api/auth if present
const rawBaseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || '';
const baseURL = rawBaseURL.replace(/\/$/, '').replace(/\/api\/auth$/, '');

export const auth = betterAuth({
  baseURL: baseURL || undefined,
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
});
