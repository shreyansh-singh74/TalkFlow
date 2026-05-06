# TalkFlow Web

Next.js app for authentication, agents, meetings, call UI, and pronunciation results.

## Routes

- Auth: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- App: `/agents`, `/agents/[agentId]`, `/meetings`, `/meetings/[meetingId]`, `/call/[meetingId]`
- API: `/api/auth/*`, `/api/agents*`, `/api/meetings*`

Prototype routes and placeholders have been removed: `/test-recorder`, `/upgrade`, `/api/config`, `/api/meetings/generate-token`, and `/api/webhook`.

## Environment

```env
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
BETTER_AUTH_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

## Run

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```
