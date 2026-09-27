import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Pooled TCP client speaking the standard Postgres wire protocol, so it works
 * against any Postgres: the compose `db` service, a local instance, and Neon
 * cloud alike (Neon accepts plain TCP; the URL's sslmode=require is honoured
 * by postgres.js).
 *
 * This used to be `@neondatabase/serverless`, which sends queries as HTTPS
 * calls to Neon's proxy — it could never reach a local Postgres, which is why
 * `docker compose up` produced a web container whose migrations silently
 * no-op'd and whose first request failed. The neon driver only pays off on
 * edge runtimes; this app runs in Node, so the wire protocol is strictly more
 * portable.
 */
const client = postgres(process.env.DATABASE_URL!, {
  // Next.js can burst with concurrent requests; 10 connections covers it
  // without exhausting Postgres's default 100-connection budget.
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle({ client });
