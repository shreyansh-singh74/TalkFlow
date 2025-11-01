# Correct Vercel Environment Variables

## ✅ Correct Configuration

### Required Variables:

```
BETTER_AUTH_URL=https://talk-flow-black.vercel.app
NEXT_PUBLIC_APP_URL=https://talk-flow-black.vercel.app
```

### Optional (can remove if not needed):

```
NEXT_PUBLIC_BETTER_AUTH_URL=https://talk-flow-black.vercel.app
```

**Note:** If you set `NEXT_PUBLIC_BETTER_AUTH_URL`, it should be just the domain (no `/api/auth`)

---

## ❌ Incorrect Configuration

**WRONG:**
```
NEXT_PUBLIC_BETTER_AUTH_URL=https://talk-flow-black.vercel.app/api/auth
```

**Why it's wrong:**
- Better Auth's `baseURL` should be just the domain
- Better Auth automatically appends `/api/auth` when needed
- Including `/api/auth` in baseURL can cause double paths like `/api/auth/api/auth/callback/google`

---

## ✅ Complete Environment Variables List

For your Vercel project, set these:

```
# Better Auth Configuration
BETTER_AUTH_URL=https://talk-flow-black.vercel.app
BETTER_AUTH_SECRET=<your-secret-key>
NEXT_PUBLIC_APP_URL=https://talk-flow-black.vercel.app

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>

# Database
DATABASE_URL=<your-neon-database-url>

# Backend API
NEXT_PUBLIC_BACKEND_URL=https://harmonious-heart-production.up.railway.app
```

---

## How baseURL Works

- `BETTER_AUTH_URL` is used by the server-side Better Auth instance
- Better Auth automatically constructs URLs like:
  - `${baseURL}/api/auth/callback/google`
  - `${baseURL}/api/auth/callback/github`
  
So if `baseURL` = `https://talk-flow-black.vercel.app`, it will create:
- `https://talk-flow-black.vercel.app/api/auth/callback/google` ✅

But if `baseURL` = `https://talk-flow-black.vercel.app/api/auth`, it might create:
- `https://talk-flow-black.vercel.app/api/auth/api/auth/callback/google` ❌

---

## Quick Fix

1. **In Vercel**, update `NEXT_PUBLIC_BETTER_AUTH_URL` to:
   ```
   https://talk-flow-black.vercel.app
   ```
   (Remove the `/api/auth` part)

2. **Or** delete `NEXT_PUBLIC_BETTER_AUTH_URL` entirely (it's optional since `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` are set)

3. **Redeploy** after changing environment variables

---

## Verify After Update

After updating, the redirect URI that Better Auth sends to Google should be:
```
https://talk-flow-black.vercel.app/api/auth/callback/google
```

Make sure this exact URL is in your Google OAuth Console's authorized redirect URIs.

