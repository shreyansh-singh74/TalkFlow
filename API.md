# API Endpoints Reference

## Agents Router (`/api/agents`)

### `agents.getMany`
**Method**: Query  
**Description**: Retrieve a paginated list of user's AI agents  
**Parameters**:
- `page?: number` - Page number (default: 1)
- `pageSize?: number` - Items per page (1-100, default: 10)
- `search?: string` - Search term for agent names

**Response**:
```typescript
{
  items: Agent[],
  total: number,
  totalPages: number
}
```

### `agents.getOne`
**Method**: Query  
**Description**: Get details of a specific agent  
**Parameters**:
- `id: string` - Agent ID

**Response**:
```typescript
{
  id: string,
  name: string,
  instructions: string,
  meetingCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

### `agents.create`
**Method**: Mutation  
**Description**: Create a new AI agent  
**Parameters**:
- `name: string` - Agent name (required)
- `instructions: string` - Agent behavior instructions (required)

**Response**: Created agent object

### `agents.update`
**Method**: Mutation  
**Description**: Update an existing agent  
**Parameters**:
- `id: string` - Agent ID (required)
- `name?: string` - Updated name
- `instructions?: string` - Updated instructions

**Response**: Updated agent object

### `agents.remove`
**Method**: Mutation  
**Description**: Delete an agent  
**Parameters**:
- `id: string` - Agent ID

**Response**: Deleted agent object

---

## Meetings Router (`/api/meetings`)

### `meetings.getMany`
**Method**: Query  
**Description**: Retrieve a paginated list of user's meetings  
**Parameters**:
- `page?: number` - Page number (default: 1)
- `pageSize?: number` - Items per page (1-100, default: 10)
- `search?: string` - Search term for meeting names
- `agentId?: string` - Filter by specific agent
- `status?: MeetingStatus` - Filter by meeting status

**Response**:
```typescript
{
  items: Meeting[],
  total: number,
  totalPages: number
}
```

### `meetings.getOne`
**Method**: Query  
**Description**: Get details of a specific meeting  
**Parameters**:
- `id: string` - Meeting ID

**Response**:
```typescript
{
  id: string,
  name: string,
  status: MeetingStatus,
  agent: Agent,
  duration: number | null,
  startedAt: Date | null,
  endedAt: Date | null,
  transcriptUrl: string | null,
  recordingUrl: string | null,
  summary: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

### `meetings.create`
**Method**: Mutation  
**Description**: Create a new meeting  
**Parameters**:
- `name: string` - Meeting name (required)
- `agentId: string` - Associated agent ID (required)

**Response**: Created meeting object

### `meetings.update`
**Method**: Mutation  
**Description**: Update an existing meeting  
**Parameters**:
- `id: string` - Meeting ID (required)
- `name?: string` - Updated name
- `agentId?: string` - Updated agent assignment

**Response**: Updated meeting object

### `meetings.remove`
**Method**: Mutation  
**Description**: Delete a meeting  
**Parameters**:
- `id: string` - Meeting ID

**Response**: Deleted meeting object

---

## Meeting Status Enum

```typescript
enum MeetingStatus {
  Upcoming = "upcoming",
  Active = "active", 
  Processing = "processing",
  Completed = "completed",
  Cancelled = "cancelled"
}
```

---

## Authentication

All API endpoints require authentication. Include the session token in requests:

```typescript
// Using the auth client
import { authClient } from "@/lib/auth-client";

const { data: session } = authClient.useSession();
```

---

## Error Handling

API errors follow tRPC error conventions:

```typescript
{
  code: "NOT_FOUND" | "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR" | ...,
  message: string
}
```

Common error codes:
- `UNAUTHORIZED` - User not authenticated
- `NOT_FOUND` - Resource not found or access denied
- `INTERNAL_SERVER_ERROR` - Database or server error
- `BAD_REQUEST` - Invalid input parameters

---

## Usage Examples

### Creating an Agent
```typescript
const createAgent = trpc.agents.create.useMutation();

await createAgent.mutateAsync({
  name: "Sales Assistant",
  instructions: "Help facilitate sales calls by taking notes and suggesting follow-up questions."
});
```

### Scheduling a Meeting
```typescript
const createMeeting = trpc.meetings.create.useMutation();

await createMeeting.mutateAsync({
  name: "Client Onboarding Call",
  agentId: "agent_abc123"
});
```

### Fetching Meetings with Filters
```typescript
const { data: meetings } = trpc.meetings.getMany.useQuery({
  page: 1,
  pageSize: 20,
  status: MeetingStatus.Completed,
  search: "client"
});
```