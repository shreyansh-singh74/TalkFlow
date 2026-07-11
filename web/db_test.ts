import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    return;
  }
  const sql = neon(url);
  try {
    const result = await sql`
      select "id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id" 
      from "session" 
      where "session"."token" = 'AlEiGPrTZTFoPy2XlFg2TGjdHjls2Fdq'
    `;
    console.log("Query success! Result:", result);
  } catch (error) {
    console.error("Query failed with error:", error);
  }
}
run().catch(console.error);
