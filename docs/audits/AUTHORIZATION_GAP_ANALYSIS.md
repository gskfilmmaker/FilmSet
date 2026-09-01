# FilmSet — Authorization Gap Analysis

**Audit deliverable 3 of 11.** Covers Parts 6–13 of the audit mandate: identity/access architecture, role hierarchy, permission model, data sensitivity, temporal access, session security, MFA/SSO readiness, and step-up authentication. Each section states what exists today (with file references), what's missing, and why it matters — concretely, not generically.

---

## 1. A Live Bug Found During This Audit

While tracing session handling for Part 11, this audit found a **currently-live availability bug**, not a hypothetical one:

`packages/auth/src/server.ts`'s `getSessionUser()` calls `supabase.auth.getUser()` with **no timeout, no deadline race, no fallback** — the exact pattern that took the entire production site down earlier today (`MIDDLEWARE_INVOCATION_TIMEOUT` on every route) before being fixed in `packages/auth/src/middleware.ts` via `withDeadline()`. That fix was applied **only** to the middleware's copy of this call. `getSessionUser()` is called by `requireUser()`, which is called by `requireCurrentProduction()` — i.e., by **every Server Component page load and every Server Action** in the app. If Supabase's Auth API is slow again, every page and every mutation is exposed to the same failure mode the middleware fix just closed off, through a different door.

**This should be treated as a P0 item, ahead of new feature work**, precisely because it's the same class of incident that already happened once today, in a part of the codebase this audit's own Part 1 mandate said to trace rather than assume. See `IMPLEMENTATION_ROADMAP.md` §P0.

---

## 2. Current Identity Model

There is no "organization" entity. The hierarchy today is flat:

```
auth.users (Supabase-managed)
  → profiles (1:1, app-managed via a Postgres trigger on signup)
      → production_members (N:M join: user × production, carries `role`)
          → productions
```

Part 6 of the mandate asks for authorization to consider "organization, production, project, role, department, membership, assignment, resource, resource sensitivity, requested action, membership status, effective dates, session context." Today, exactly **two** of those inputs exist and are checked: production membership (via RLS) and role (via `assertRole()`, app-layer only, see Architecture Map §4). None of the rest exist:

| Input Part 6 requires | Exists today? |
|---|---|
| Organization | No — no entity above Production |
| Production | Yes — RLS-enforced |
| Department (as an authorization scope) | No — `department` is free text on `crew_members`, not a scope anything checks against |
| Role | Partially — flat enum, app-layer only |
| Membership status | No — membership is binary (row exists or doesn't); no Active/Suspended/Expired states |
| Assignment | No |
| Resource sensitivity | No |
| Requested action (granular) | No — authorization is "can touch this table," not "can do this specific action to this specific field" |
| Effective start/end dates | No |
| Session context (risk, device, MFA state) | No — none of this is tracked at all |

## 3. Role Hierarchy — Current vs. Proposed

**Current** (`packages/auth/src/index.ts`): `Producer`, `Director`, `1st AD`, `UPM`, `Production Accountant`, `Department Head`, `Crew` — seven flat, hardcoded values, one per user per production, no department parameter, no custom roles possible without a code change.

**Proposed** (template roles, not exhaustive — Part 7 explicitly requires custom-role support, so this is a starting seed set, not a closed list):

| Tier | Roles |
|---|---|
| Platform | Platform Security Admin |
| Organization | Organization Owner, Organization Admin |
| Production leadership | Production Super Admin, Executive Producer, Producer, Line Producer, UPM |
| Production management | Production Manager, Production Coordinator, APOC, 1st AD, 2nd AD |
| Department | Department Head, Department Coordinator, Department Member |
| Finance | Production Accountant |
| Logistics | Travel Coordinator, Transport Coordinator, Catering Head, Booking Manager |
| External | Cast, Background, Vendor, External Viewer |

**Design principle carried through `SECURITY_ARCHITECTURE_V1.md` and `PERMISSION_MATRIX_V1.md`**: these are **templates that grant a bundle of permissions**, not the authorization primitive itself. Job titles must never be encoded directly into `if (role === "...")` checks in application code (as `assertRole()` does today) — the check must always be "does this principal hold permission `X` on resource `Y`," resolved through the roles/permissions they hold, so a custom role or a permission override doesn't require a code change.

## 4. Permission Model — Current vs. Proposed

**Current**: none. There is no `permissions` table, no permission string vocabulary, no mapping from role → allowed actions beyond the literal `if` logic inside each Server Action.

**Proposed**: `resource.action` strings (full catalog in `PERMISSION_MATRIX_V1.md`), e.g. `schedule.view`, `schedule.manage`, `schedule.publish`, `budget.view_summary`, `budget.view_detail`, `budget.manage`, `budget.approve`, `contracts.view_sensitive`, `transport.manage`, `travel.manage`, `catering.manage`, `security.audit.view`, `security.sessions.revoke`, `permissions.manage`.

**Default rule, per Part 6**: DENY unless explicitly authorized. This is a real change from today's model, where the default for any table a Server Action *forgets* to guard is effectively **ALLOW to any production member** (RLS permits it; nothing else stops it). Moving to explicit DENY-by-default requires a central authorization check function that every Server Action calls before acting — replacing the current pattern where each action independently decides whether to call `assertRole()` at all.

## 5. Department-Scoped Access — The Concrete HOD Gap

Today, `isHod` (`crew_members.is_hod`, `packages/db/migrations/0006_crew_hod_flag.sql`) is a boolean with zero authorization consequence — it only affects sort order and Contact Sheet formatting. Meanwhile `Department Head` (a `PRODUCTION_ROLES` value) is **not** parameterized by which department, so today a Wardrobe HOD and a Camera HOD are indistinguishable to the authorization system — both simply hold the role string `"Department Head"`.

**Concrete consequence**: nothing in the codebase can express "the Wardrobe HOD may manage Wardrobe & Continuity data but should not automatically see Camera department budget lines" — Part 5's explicit requirement. Fixing this needs first-class `Department`/`DepartmentMembership`/`DepartmentHeadAssignment` entities (designed in `LOGISTICS_DOMAIN_MODEL.md` §5) wired into the permission engine, not another boolean flag.

## 6. Data Sensitivity — Current vs. Proposed

**Current**: zero classification. Every column in every table is either fully visible to any production member (the RLS-only tables) or fully invisible to non-members — there is no gradient. Concretely sensitive data already stored today with no extra protection:

| Data | Where | Currently visible to |
|---|---|---|
| Cast/crew phone, email | `contactInfoSchema` fields on `cast_members`, `crew_members` | Any production member |
| Sizing information (potentially minors) | `sizingInfoSchema` | Any production member |
| Deal memos / compliance documents | `production-files` bucket | Any production member (storage RLS is membership-only) |
| Expense amounts / vendor payment info | `expenses` table | Any production member |

**Proposed classification** (Part 9): `PUBLIC` → `PRODUCTION_GENERAL` → `DEPARTMENT_RESTRICTED` → `CONFIDENTIAL` → `HIGHLY_CONFIDENTIAL` → `STUDIO_RESTRICTED`. Field-level masking (e.g., showing "•••• 4821" instead of a full bank routing number to a role without `contracts.view_sensitive`) is architecturally new work — nothing today masks any field ever; a query either returns a row or it doesn't.

## 7. Temporal Access

**Current**: `production_members` has no `effectiveFrom`/`effectiveUntil`/`status` columns — membership is binary (the row exists, or a member was hard-removed). A wrapped crew member's account retains full access to every table/bucket their role permits, indefinitely, unless someone remembers to remove them.

**Proposed**: `status` enum (`ACTIVE`, `SCHEDULED`, `SUSPENDED`, `EXPIRED`, `REVOKED`) plus `effectiveFrom`/`effectiveUntil`, checked by the authorization engine on every request (not just at membership-creation time) — an expired membership must stop granting access automatically, not only when someone notices and deletes the row.

## 8. Session Security

**Current**: none, per Architecture Map §3 — no `sessions` table, no login history, no device tracking, no "your active sessions" UI, no revocation capability beyond Supabase's own (unexposed) session management.

**Proposed** (`Session`, `SessionDevice`, `AuthenticationEvent`, `SecurityEvent` — full shape in `SECURITY_ARCHITECTURE_V1.md`): record authenticated user, session id, login timestamp, last activity, logout/expiry, source IP, user agent, coarse IP-derived location (never claimed as precise physical location — see `CONTENT_SECURITY_ROADMAP.md`'s privacy note), device label where determinable, MFA state, auth method, risk state. Users see their own active sessions; authorized admins see project/org security visibility per policy; sessions are revocable.

## 9. MFA / Passkey / SSO Readiness

**Current**: Supabase Auth is used purely for email+password (`supabase.auth.signInWithPassword`/`signUp` — confirmed by reading every auth page). Supabase itself supports TOTP MFA, WebAuthn/passkeys, and OIDC/SAML SSO at the platform level — **none of this is wired into FilmSet's UI or enforced anywhere**. This is a readiness gap, not a rebuild: Supabase's own SDK exposes the APIs needed; FilmSet's auth pages (`app/login`, `app/signup`) would need new UI and enrollment flows, and `packages/auth` would need to check MFA/AAL (Authenticator Assurance Level) state where required.

**Explicit constraint carried forward**: do not implement custom cryptography for any of this — use Supabase's built-in MFA/passkey/OIDC primitives.

## 10. Step-Up Authentication

**Current**: does not exist as a concept — there is no distinction between "recently authenticated" and "authenticated at some point in this session" anywhere in the code.

**Proposed**: a framework requiring recent strong authentication (re-entered password, or fresh MFA/passkey challenge) before named critical actions — changing a Production Super Admin, managing security permissions, exporting highly sensitive records, changing financial details, disabling MFA, mass exports, deleting/closing a production, creating privileged API credentials. Depends on §9 (MFA readiness) landing first — step-up authentication is meaningless without a second factor to step up *to*.

## 11. What Blocks What

```
Session Security (§8) ──┐
MFA/Passkey (§9) ───────┼──> Step-Up Auth (§10)
                         │
Role/Permission Model ───┼──> Department Scoping (§5) ──> Logistics-role permissions
(§3, §4)                 │     (Travel Coordinator, Transport Coordinator, etc.)
                         │
                         └──> Data Sensitivity (§6) ──> Field-level masking
```

Building department- or logistics-scoped permissions (Part 5, and the Travel/Transport/Catering Head roles in Part 7) **before** the general permission engine (§3–§4) exists would mean writing bespoke authorization logic per feature — exactly the technical debt the audit's own mandate warns against. This is the basis for `IMPLEMENTATION_ROADMAP.md` sequencing Permissions Foundation (P1) ahead of Departments/HOD (P2).
