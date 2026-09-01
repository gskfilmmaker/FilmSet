# FilmSet — Current Architecture Map

**Audit deliverable 2 of 11.** A factual map of what exists today, traced from the actual repository at commit `1df2379` (branch `claude/session-35ned1`, in sync with `main`). No aspirational content — see `IMPLEMENTATION_ROADMAP.md` for what's proposed. Every claim below is grounded in a specific file; paths are given so any statement here can be re-verified in seconds.

---

## 1. Monorepo Structure

Turborepo + pnpm workspaces. Six packages, one app:

| Package | Role | Depends on |
|---|---|---|
| `packages/tokens` | Design tokens (color/spacing/motion), compiled to CSS | — |
| `packages/ui` | Component library (`@filmset/ui`), Radix-based | `tokens` |
| `packages/core` | Zod domain schemas — the shared type contract | — |
| `packages/db` | Drizzle ORM schema, SQL migrations, seed script | `core` |
| `packages/auth` | Supabase Auth wiring (browser/server/middleware clients), role vocabulary | — |
| `apps/web` | Next.js 15 App Router application | all of the above |

No other apps (no separate API service, no mobile app, no admin app). No CI configuration exists (`.github/` is absent). No test runner is configured at the root (`package.json` has a `test` script that fans out to `turbo run test`, but no package defines one that runs anything beyond `packages/ui`'s single Playwright a11y spec, `packages/ui/a11y-tests/frame.spec.ts`).

## 2. Request Path — How a Page Actually Works

There is **no separate API layer**. `apps/web/app/**` contains zero `route.ts` files. Every mutation goes through a Next.js **Server Action** (a function marked `"use server"` in a route's `actions.ts`), called directly from a Client Component. Every read happens in a **Server Component** at render time via `apps/web/lib/queries.ts`.

Concretely, for a protected page:

```
Browser request
  → apps/web/middleware.ts (matches almost every path)
      → packages/auth/src/middleware.ts: updateSession()
          → supabase.auth.getUser() (network call to Supabase Auth API)
          → redirect to /login if no user, else pass through
  → app/<route>/page.tsx (Server Component)
      → apps/web/lib/authz.ts: requireCurrentProduction()
          → packages/auth/src/server.ts: requireUser() → getSessionUser()
              → supabase.auth.getUser() (a SECOND, independent network call —
                see §6, Finding A)
          → runAsUser(user.id, ...) reads profiles.active_production_id +
            production_members to resolve the active production
      → apps/web/lib/queries.ts: getProductionSnapshot() or similar
          → runAsUser(user.id, (tx) => tx.select()...) — RLS-scoped query
  → render, hand to a Client Component for interactivity
```

For a mutation:

```
Client Component → import { someAction } from "./actions"
  → apps/web/app/<route>/actions.ts: someAction(...)
      → requireCurrentProduction() or requireProductionMember(productionId, roles)
      → runAsUser(user.id, (tx) => tx.insert/update/delete(...))
      → revalidatePath / caller calls router.refresh()
```

This is a **thin, direct architecture**: no queue, no background job runner, no webhook receiver, no message bus. Every AI call (`apps/web/lib/ai.ts`) is a synchronous request inside a Server Action — there is no async job for long-running AI work.

## 3. Authentication

- **Provider**: Supabase Auth (email + password only). No OAuth/SSO provider is configured. No MFA, no passkeys/WebAuthn. Confirmed by reading every auth-surface page (`app/login`, `app/signup`, `app/forgot-password`, `app/reset-password`) — all use `supabase.auth.signInWithPassword` / `signUp` / `resetPasswordForEmail` / `updateUser`, nothing else.
- **Session storage**: cookie-based, via `@supabase/ssr`'s `createServerClient`/`createBrowserClient`. Three separate client constructors exist — `packages/auth/src/browser.ts`, `server.ts`, `middleware.ts` — each independently calls `supabase.auth.getUser()` when they need the current user. **These are not deduplicated or cached within a single request** (see §6, Finding A).
- **Session refresh**: happens only in `middleware.ts` (`packages/auth/src/middleware.ts`), the one place allowed to write cookies on every request. As of commit `1df2379`, that call is wrapped in a 6-second hard deadline (`withDeadline`) that fails open (lets the request through) rather than blocking indefinitely — added today, in direct response to a production incident where an unbounded Supabase Auth call took the entire site down (`MIDDLEWARE_INVOCATION_TIMEOUT` on every route).
- **No session/device records.** There is no `sessions`, `session_devices`, or `authentication_events` table. "Active sessions" as a user-visible concept does not exist — Supabase manages the JWT/refresh-token lifecycle internally and the app never reads or displays it.

## 4. Authorization

Two independent mechanisms, only loosely related:

**A. Postgres Row-Level Security** (`packages/db/migrations/0001_rls_and_auth_trigger.sql`, plus tenant-isolation hardening in `0002_cross_production_guards.sql`). Every table has RLS enabled. The general policy shape is: *a user may read/write a row if they are a member of that row's production* — checked via a `security definer` helper function, `is_production_member(production_id)`, that avoids policy recursion. This is enforced **regardless of the user's role** for nearly every table. The one exception: `productions` and `production_members` themselves carry an explicit `pm.role = 'Producer'` check (line 73, `0001_rls_and_auth_trigger.sql`) restricting who can update/delete a production or manage other members' roles.

  Connections authenticate as the `authenticated` Postgres role via `runAsUser(userId, fn)` (`packages/db/src/client.ts`), which opens a transaction, runs `SET LOCAL ROLE authenticated` and sets `request.jwt.claims` so Supabase's `auth.uid()` resolves correctly — this is what makes RLS a real boundary rather than a formality (the app's actual `DATABASE_URL` connects as `postgres`, which would otherwise bypass RLS entirely). `anon` has no grants on any table.

**B. Application-layer role checks** (`packages/auth/src/server.ts`: `assertRole()`, called from `apps/web/lib/authz.ts`: `requireProductionMember()`). `role` is a plain `text` column on `production_members` (`packages/db/src/schema.ts:83`) — **not** a Postgres enum, **not** a foreign key to a roles table, **no** `CHECK` constraint. The valid values are enforced only by a TypeScript union, `PRODUCTION_ROLES` (`packages/auth/src/index.ts`): `Producer`, `Director`, `1st AD`, `UPM`, `Production Accountant`, `Department Head`, `Crew`. A Server Action that wants role-gated behavior must remember to call `assertRole(membership, [...allowedRoles])`; nothing prevents a new Server Action from forgetting to.

  This means role-based restriction is real but **is not defense-in-depth** — a bug in one Server Action (a missing `assertRole` call, or the wrong role list) is not caught by anything at the database layer, because RLS itself doesn't know or care what role the user holds for that table.

- **No attribute-based access control.** No concept of resource sensitivity, time-bounded membership, or session risk factors into any authorization decision today.
- **No department-scoped permission.** `Department Head` is one of the seven flat roles above — it is not parameterized by *which* department. A `crew_members.is_hod` boolean flag exists (`packages/db/migrations/0006_crew_hod_flag.sql`) but is purely a display/report flag (sorts first, called out on the Contact Sheet, feeds the "needs a department head" gap-check) — it carries **no authorization meaning**. Nothing in the codebase checks "is this user the HOD of *this specific* department" before granting access to anything.

## 5. Object Storage

Two private Supabase Storage buckets, both RLS-gated by the same `is_production_member()` helper used for table RLS:

| Bucket | Migration | Used for |
|---|---|---|
| `production-photos` | `0010_photo_storage_bucket.sql` | Cast headshots, location photos |
| `production-files` | `0015_production_files_bucket.sql` | Expense receipts, deal memos, compliance documents |

Both buckets' policies are **membership-gated only** — any member of a production, regardless of role, can read, upload, update, or delete any object in that production's folder. There is no per-role or per-document-sensitivity restriction at the storage layer (e.g., a `Crew`-role member can delete a Producer-uploaded deal memo). Files are served via short-lived signed URLs generated server-side (`apps/web/lib/photo-storage.ts`, `apps/web/lib/file-storage.ts`) — never public URLs. Upload validation (`MAX_PHOTO_BYTES`, `ALLOWED_PHOTO_TYPES`) exists for photos only.

## 6. Notifications & Audit — What Exists Today

- **"Notifications"** (`apps/web/app/notifications-actions.ts`) are **computed on every read**, not persisted or delivered: `getNotifications()` queries pending `ai_recommendations` and pending `approvals` for the caller's active production and returns them. There is no notification table, no read/unread state, no email or push delivery, no per-user preference.
- **The only audit-like table** in the schema is `ai_suggestion_log` (`packages/db/src/schema.ts:576`) — `productionId`, `requestedBy`, `kind`, `input` (jsonb), `suggestion` (jsonb), `explanation`, `status`, `createdAt`, `decidedAt`. It logs every AI Suggest call and its eventual approve/reject decision. **It logs nothing else** — no manual (non-AI) field edit is recorded anywhere, no login/logout event, no permission change, no file download, no failed-authorization attempt. There is no immutability guarantee (it's a normal `pgTable`, editable/deletable by anyone with `postgres`-role access, i.e. migrations and the seed script).
- **No security event stream exists at all.**

## 7. AI Layer

`apps/web/lib/ai.ts` — the only place the app calls an LLM (Anthropic's Claude API, via `@anthropic-ai/sdk`). Every function here is pure **Suggest** (and, for recommendations, **Explain**): none of them write to the database. Callers in `app/*/actions.ts` are responsible for **Preview → Approve → Commit**: rendering the suggestion for human review, requiring an explicit click, and only then calling the same `create`/`update` Server Action a manual edit would use. This governance chain is real and already enforced by code structure (the AI functions have no database client in scope at all — they cannot write even if a caller wanted them to), not just a documented convention.

File parsing for the Universal Import feature (`apps/web/lib/import/`) uses `xlsx` (SheetJS) for CSV/XLSX, `pdf-parse`/`pdfjs-dist` for PDF text extraction, and `mammoth` for DOCX — all running inside the same synchronous Server Action, with no size/timeout governor beyond Vercel's platform-level function timeout.

## 8. Environment & Configuration

Four environment variables total (`apps/web/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`. No secrets manager beyond Vercel's own environment variable store. No feature-flag system. No rate limiting anywhere in the stack (not at the Next.js layer, not at Supabase — beyond whatever Supabase's own platform defaults impose).

## 9. Deployment

Vercel (`film-set-web` project), auto-deploying `main` to production and every branch to a preview URL. No staging environment distinct from Vercel preview deployments. No infrastructure-as-code (Supabase project and Vercel project are both configured through their respective dashboards, not version-controlled).

## 10. What This Map Feeds

- `AUTHORIZATION_GAP_ANALYSIS.md` — expands §4 and §6 into a full RBAC/ABAC gap analysis.
- `SECURITY_ARCHITECTURE_V1.md` — proposes the session, audit, and IAM architecture this map shows is currently absent.
- `THREAT_MODEL.md` — several threats trace directly to gaps identified here (membership-only storage RLS, no session tracking, app-layer-only role enforcement).
- `FILMSET_PLATFORM_GAP_AUDIT.md` — the module-by-module capability classification this map underlies.
