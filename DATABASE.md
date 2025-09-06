# Database Schema Documentation

## Overview
MeetAi uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema consists of tables for user management, AI agents, and meeting management.

## Tables

### `user`
Stores user account information and authentication data.

```sql
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Fields:**
- `id` - Unique user identifier
- `name` - User's display name
- `email` - User's email address (unique)
- `email_verified` - Whether email has been verified
- `image` - Profile image URL (from OAuth providers)
- `created_at` - Account creation timestamp
- `updated_at` - Last profile update timestamp

---

### `session`
Manages user authentication sessions.

```sql
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
```

**Fields:**
- `id` - Session identifier
- `expires_at` - Session expiration timestamp
- `token` - Session token (unique)
- `ip_address` - Client IP address
- `user_agent` - Client user agent string
- `user_id` - Foreign key to user table

---

### `account`
Stores OAuth provider account information.

```sql
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP,
  "refresh_token_expires_at" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL
);
```

**Fields:**
- `account_id` - Provider-specific account ID
- `provider_id` - OAuth provider (github, google, etc.)
- `access_token` - OAuth access token
- `refresh_token` - OAuth refresh token
- `password` - Hashed password (for email/password auth)

---

### `verification`
Stores email verification and password reset tokens.

```sql
CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

**Fields:**
- `identifier` - Email address or identifier
- `value` - Verification token
- `expires_at` - Token expiration timestamp

---

### `agents`
Stores AI agent configurations and instructions.

```sql
CREATE TABLE "agents" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(),
  "name" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "instructions" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Fields:**
- `id` - Unique agent identifier (nanoid)
- `name` - Agent display name
- `user_id` - Foreign key to user table
- `instructions` - AI agent behavior instructions
- `created_at` - Agent creation timestamp
- `updated_at` - Last update timestamp

**Relationships:**
- Belongs to one user
- Has many meetings

---

### `meetings`
Stores meeting information, status, and associated data.

```sql
CREATE TYPE "meeting_status" AS ENUM (
  'upcoming',
  'active', 
  'processing',
  'completed',
  'cancelled'
);

CREATE TABLE "meetings" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(),
  "name" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "agent_id" TEXT NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" meeting_status NOT NULL DEFAULT 'upcoming',
  "started_at" TIMESTAMP,
  "ended_at" TIMESTAMP,
  "transcript_url" TEXT,
  "recording_url" TEXT,
  "summary" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Fields:**
- `id` - Unique meeting identifier (nanoid)
- `name` - Meeting display name
- `user_id` - Foreign key to user table
- `agent_id` - Foreign key to agents table
- `status` - Current meeting status (enum)
- `started_at` - Meeting start timestamp
- `ended_at` - Meeting end timestamp
- `transcript_url` - URL to meeting transcript
- `recording_url` - URL to meeting recording
- `summary` - AI-generated meeting summary

**Meeting Status Values:**
- `upcoming` - Scheduled but not started
- `active` - Currently in progress
- `processing` - Ended, being processed for transcript/summary
- `completed` - Finished with all data available
- `cancelled` - Meeting was cancelled

**Relationships:**
- Belongs to one user
- Belongs to one agent

---

## Indexes and Constraints

### Primary Keys
- All tables use TEXT primary keys
- `agents` and `meetings` use nanoid() for ID generation

### Foreign Keys
- All foreign keys include `ON DELETE CASCADE`
- Ensures data integrity when users/agents are deleted

### Unique Constraints
- `user.email` - Ensures unique email addresses
- `session.token` - Ensures unique session tokens

### Default Values
- Timestamps default to current time
- Boolean fields have appropriate defaults
- Meeting status defaults to 'upcoming'

---

## Relationships Diagram

```
user (1) ──── (many) agents
user (1) ──── (many) meetings  
user (1) ──── (many) sessions
user (1) ──── (many) accounts

agents (1) ──── (many) meetings
```

---

## Database Configuration

The database connection is configured in `/src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/neon-http';

export const db = drizzle(process.env.DATABASE_URL!);
```

Schema management is handled by Drizzle Kit with configuration in `drizzle.config.ts`:

```typescript
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts', 
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Available Commands

- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio for database management

---

## Environment Variables

Required database environment variables:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/meetai"
```

For production, use a secure PostgreSQL connection string from your database provider.