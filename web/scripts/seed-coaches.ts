import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as path from "path";
import { coaches, user } from "../src/db/schema";
import { DEFAULT_COACHES } from "../src/modules/coaches/default-coaches";
import { eq, and } from "drizzle-orm";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle({ client: sql });

async function seed() {
  console.log("Seeding default coaches...");
  
  // Find first user to assign coaches to
  const usersList = await db.select().from(user).limit(1);
  if (usersList.length === 0) {
    console.error("No users found in database. Please register a user first through the app signup/login.");
    process.exit(1);
  }
  
  const userId = usersList[0].id;
  console.log(`Assigning seeded coaches to user ID: ${userId}`);

  // Same definitions the API route seeds a fresh account with, so running this
  // by hand can never produce a different starting set.
  const defaultCoaches = DEFAULT_COACHES.map((coach) => ({ ...coach, userId }));

  for (const coach of defaultCoaches) {
    // Check if coach already exists for this user
    const existing = await db
      .select()
      .from(coaches)
      .where(and(eq(coaches.name, coach.name), eq(coaches.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(coaches).values(coach);
      console.log(`Created coach: ${coach.name}`);
    } else {
      console.log(`Coach already exists: ${coach.name}`);
    }
  }

  console.log("Seeding complete successfully!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
