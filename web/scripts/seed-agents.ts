import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as path from "path";
import { agents, user } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle({ client: sql });

async function seed() {
  console.log("Seeding default agents...");
  
  // Find first user to assign agents to
  const usersList = await db.select().from(user).limit(1);
  if (usersList.length === 0) {
    console.error("No users found in database. Please register a user first through the app signup/login.");
    process.exit(1);
  }
  
  const userId = usersList[0].id;
  console.log(`Assigning seeded agents to user ID: ${userId}`);

  const defaultAgents = [
    {
      name: "Daily Conversation Coach",
      instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
      userId,
    },
    {
      name: "Interview English Coach",
      instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
      userId,
    },
    {
      name: "Pronunciation Drill Coach",
      instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
      userId,
    },
  ];

  for (const agent of defaultAgents) {
    // Check if agent already exists for this user
    const existing = await db
      .select()
      .from(agents)
      .where(and(eq(agents.name, agent.name), eq(agents.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(agents).values(agent);
      console.log(`Created agent: ${agent.name}`);
    } else {
      console.log(`Agent already exists: ${agent.name}`);
    }
  }

  console.log("Seeding complete successfully!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
