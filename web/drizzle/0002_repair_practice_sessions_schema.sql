-- Repair databases that were created from the pre-Drizzle practice_sessions schema.
-- Both operations are safe on fresh databases where migration 0000 already matches
-- src/db/schema.ts.
ALTER TABLE "practice_sessions" ADD COLUMN IF NOT EXISTS "drill_phone" text;
--> statement-breakpoint
ALTER TABLE "practice_sessions" ALTER COLUMN "coach_id" DROP NOT NULL;