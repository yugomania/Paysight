# PaySight Authentication Setup

> Complete guide for configuring Supabase email/password authentication with PaySight.

---

## Overview

PaySight uses **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) for email/password authentication with server-side session management via Next.js cookies.

**Auth flows implemented:**

| Route | Behavior |
|---|---|
| `/` | Public landing page — no auth required |
| `/auth/login` | Sign in with email + password |
| `/auth/signup` | Create new account |
| `/auth/callback` | Email confirmation redirect handler |
| `/dashboard` | Protected — requires authenticated session |
| `/dashboard/*` | Protected — all sub-routes require auth |

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your organization and set a project name (e.g. `paysight`).
4. Set a secure database password and choose a region close to your Render deployment (e.g. **us-west-1** for Oregon).
5. Click **Create new project** and wait for it to initialize.

---

## 2. Enable Email/Password Auth

1. In your Supabase project, go to **Authentication → Providers**.
2. Confirm **Email** is enabled (it is by default).
3. Configure your preferences:

| Setting | Recommended Value |
|---|---|
| Enable Email Signup | ✅ Enabled |
| Confirm email | ✅ Enabled (users must click email link) |
| Minimum password length | 8 |
| Secure email change | ✅ Enabled |

---

## 3. Configure Redirect URLs

1. In Supabase go to **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed application URL:
   ```
   https://YOUR-RENDER-APP-NAME.onrender.com
   ```
3. Under **Redirect URLs**, add all allowed callback destinations:
   ```
   https://YOUR-RENDER-APP-NAME.onrender.com/auth/callback
   http://localhost:3000/auth/callback
   ```
   > ⚠️ Replace `YOUR-RENDER-APP-NAME` with your actual Render service name. Do not use a placeholder URL.

---

## 4. Get Your API Credentials

1. In Supabase go to **Settings → API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

> ⚠️ **Never** use the `service_role` key in client-side or browser code. It bypasses Row Level Security and must only be used in trusted server-side environments.

---

## 5. Set Environment Variables

### Local Development

Create `.env.local` in the project root (never commit this file):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Render Deployment

In your Render service dashboard → **Environment**:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon public key |

The `render.yaml` file already includes these variables as `sync: false` (manual entry required for security).

---

## 6. How Sign Up Works

1. User visits `/auth/signup` and fills in email, password, confirm password.
2. Validation runs locally — invalid fields show errors before any network call.
3. On submit: `supabase.auth.signUp()` is called with the user's email and password.
4. The `emailRedirectTo` is set to `{origin}/auth/callback` for email confirmation.
5. **If email confirmation is enabled (default):**
   - Supabase sends a confirmation email.
   - The page shows a "Check your inbox" message.
   - The `/auth/callback` route exchanges the confirmation code for a session.
   - The user is redirected to `/dashboard`.
6. **If email confirmation is disabled:**
   - The user is signed in immediately after signup.
   - They are redirected to `/dashboard`.

---

## 7. How Sign In Works

1. User visits `/auth/login` and enters email + password.
2. `supabase.auth.signInWithPassword()` is called.
3. On success: the browser is redirected to `/dashboard`.
4. On failure: a user-friendly error message is shown (invalid credentials, unconfirmed email, etc.).
5. The middleware (`src/middleware.ts`) refreshes the session on every request and validates cookies server-side.

---

## 8. How Sign Out Works

1. The **Sign Out** button (LogOut icon) appears in the sidebar footer of the dashboard.
2. Clicking it calls `supabase.auth.signOut()`.
3. All session cookies are cleared.
4. The user is redirected to `/auth/login`.

---

## 9. Session Management Architecture

PaySight uses the official `@supabase/ssr` approach for Next.js:

```
src/
  lib/supabase/
    client.ts     ← Browser-side client (uses NEXT_PUBLIC_ vars)
    server.ts     ← Server-side client (reads/writes cookies)
  middleware.ts   ← Session refresh + route protection
  app/auth/callback/route.ts  ← Email confirmation handler
  app/dashboard/layout.tsx    ← Server-side auth guard
```

**Protection is layered:**
- `middleware.ts` — edge-level redirect for unauthenticated users
- `app/dashboard/layout.tsx` — server component auth guard (belt-and-suspenders)
- API routes optionally check auth (see Phase 7 security notes)

---

## 10. Render Deployment Checklist

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in Render environment
- [ ] Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Render environment
- [ ] Set Supabase Site URL to your Render URL
- [ ] Add `/auth/callback` to Supabase Redirect URLs
- [ ] Deploy and verify login/signup flows end-to-end
- [ ] Verify HTTPS cookies work (Render provides HTTPS automatically)

---

## 11. Troubleshooting

| Problem | Solution |
|---|---|
| "Missing Supabase environment variables" | Check `.env.local` has both SUPABASE vars set |
| Login redirects back to login page | Check Supabase Site URL matches your app URL exactly |
| Email confirmation link expired | Supabase tokens expire after 24h — user must re-sign-up or use another email |
| Session lost on page refresh | Ensure middleware.ts is running — check `src/middleware.ts` exists |
| Redirect loop | Verify middleware matcher doesn't match `/auth/` paths for auth guard |
| Callback returns `confirmation_failed` | Check Redirect URLs in Supabase match `/auth/callback` exactly |

---

## 12. Single-Tenant Security Limitations

> ⚠️ **Important — read before deploying to production**

PaySight was originally designed as a **single-tenant merchant workspace**. Authentication has been added, but the underlying data architecture is **not multi-tenant**.

### What this means

| Data type | Storage | Multi-user isolation? |
|---|---|---|
| Transactions | JSON file (`.data/paysight-db.json`) | ❌ Shared |
| Invoices | JSON file | ❌ Shared |
| Budget expenses | JSON file | ❌ Shared |
| Budget targets | JSON file | ❌ Shared |
| PayPal credentials | Environment variables | ❌ Single set |
| AI context | Server-side PayPal data | ❌ Shared |

### For the hackathon version

- Authentication prevents **unauthenticated** access to the dashboard and APIs.
- All **authenticated** users share the same PayPal workspace and data store.
- This is appropriate for a **single-operator** or **demo** deployment.
- Do **not** grant dashboard access to untrusted users in this architecture.

### Future multi-tenant requirements

To properly support multiple independent merchant workspaces, the following would be needed:

1. **User profiles table** — `users(id, email, created_at)`
2. **Merchant workspaces table** — `workspaces(id, owner_id, name)`
3. **Workspace membership** — `workspace_members(workspace_id, user_id, role)`
4. **Per-workspace PayPal credentials** — stored encrypted per workspace, not in env vars
5. **Per-workspace transaction storage** — scoped to `workspace_id`
6. **Per-workspace invoices, budgets, expenses** — Supabase tables with RLS policies
7. **Row Level Security (RLS)** — `auth.uid() = workspace_members.user_id`
8. **Tenant-scoped API authorization** — every API route checks session + workspace membership
9. **Tenant-scoped AI queries** — AI only sees data belonging to the authenticated workspace

This architecture would require significant refactoring and is out of scope for the current hackathon implementation.

---

## Security Notes

- Session cookies are HTTP-only and secure in production (Supabase SSR default).
- The middleware validates sessions server-side on every request — client-side checks alone are not relied upon for access control.
- The `next` redirect parameter in login URLs is validated to be a same-origin relative path before use (open-redirect prevention).
- API routes are protected by IP-based rate limiting (`src/lib/security/rate-limit.ts`).
- No service-role keys are exposed to the browser.

