/**
 * One-off, idempotent rename migration: agents -> coaches, meetings -> practice_sessions.
 *
 * This repo is drizzle-kit *push*-only (there is no `drizzle/` migrations dir).
 * `drizzle-kit push` cannot see a rename -- it diffs the schema and offers
 * drop+create, which would destroy every row. So the renames are applied here,
 * out of band, BEFORE any `npm run db:push`. Push then only ever sees
 * "add column" / "add enum".
 *
 * Safe to run twice: every step checks the catalog first and skips if the new
 * name is already in place.
 *
 *   npx tsx scripts/migrate-rename-coaches-sessions.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const db = drizzle({ client: neon(process.env.DATABASE_URL) });

async function tableExists(name: string): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = ${name}
  `);
  return rows.rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and column_name = ${column}
  `);
  return rows.rows.length > 0;
}

async function typeExists(name: string): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = ${name}
  `);
  return rows.rows.length > 0;
}

async function main() {
  const done: string[] = [];
  const skipped: string[] = [];

  // 1. agents -> coaches
  if (await tableExists("agents")) {
    if (await tableExists("coaches")) {
      throw new Error(
        "Both `agents` and `coaches` tables exist. Refusing to guess which is live " +
          "-- inspect them manually and drop or merge one before re-running."
      );
    }
    await db.execute(sql`ALTER TABLE agents RENAME TO coaches`);
    done.push("agents -> coaches");
  } else {
    skipped.push("agents -> coaches (already renamed or never existed)");
  }

  // 2. meetings -> practice_sessions
  if (await tableExists("meetings")) {
    if (await tableExists("practice_sessions")) {
      throw new Error(
        "Both `meetings` and `practice_sessions` tables exist. Refusing to guess " +
          "which is live -- inspect them manually before re-running."
      );
    }
    await db.execute(sql`ALTER TABLE meetings RENAME TO practice_sessions`);
    done.push("meetings -> practice_sessions");
  } else {
    skipped.push("meetings -> practice_sessions (already renamed or never existed)");
  }

  // 3. practice_sessions.agent_id -> coach_id
  if (await columnExists("practice_sessions", "agent_id")) {
    await db.execute(sql`ALTER TABLE practice_sessions RENAME COLUMN agent_id TO coach_id`);
    done.push("practice_sessions.agent_id -> coach_id");
  } else {
    skipped.push("practice_sessions.agent_id -> coach_id (already renamed)");
  }

  // 4. meeting_status -> practice_session_status
  if (await typeExists("meeting_status")) {
    if (await typeExists("practice_session_status")) {
      throw new Error(
        "Both `meeting_status` and `practice_session_status` enums exist. " +
          "Inspect them manually before re-running."
      );
    }
    await db.execute(sql`ALTER TYPE meeting_status RENAME TO practice_session_status`);
    done.push("meeting_status -> practice_session_status");
  } else {
    skipped.push("meeting_status -> practice_session_status (already renamed or never existed)");
  }

  for (const s of skipped) console.log(`  skip  ${s}`);
  for (const d of done) console.log(`  done  ${d}`);

  if (done.length === 0) {
    console.log("\nNothing to do -- database is already on the new names.");
  } else {
    console.log(`\n${done.length} rename(s) applied. You can now run: npm run db:push`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nMigration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
