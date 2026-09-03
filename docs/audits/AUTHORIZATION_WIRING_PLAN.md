# Authorization Wiring Plan — P1c

**Status: plan + safety-layer code only. No Server Action is touched by this document or this PR.** Every `assertRole()`/`requireProductionMember()`/`requireCurrentProduction()` call site listed below still calls exactly what it calls today, unchanged. This document exists so that when the owner authorizes wiring `authorize()` into the live app — a separate, later decision — there's a concrete, ordered, low-risk plan to follow instead of an ad hoc rewrite.

## Why this can't be "just swap the function and go"

`assertRole()` (`packages/auth/src/server.ts`) and `authorize()` (`apps/web/lib/authorize.ts`, P1b) are not drop-in replacements for each other today:

- `assertRole()` checks `production_members.role` (text) against a hardcoded `ProductionRole[]` list, per call site.
- `authorize()` checks `production_members.role_id` → `role_permissions`, plus department-scoped grants — a real permission string, not a role name.

Both are backfilled to agree for every *existing* row (P1b's migration maps every current role value onto an equivalent system-template role), but "backfilled to agree today" and "guaranteed to keep agreeing as this becomes real, editable data" are different claims. Swapping every call site in one PR, with no way to observe disagreement before it happens, is exactly the risk the owner's staged-cutover instruction exists to avoid. This plan is the alternative: migrate call sites one at a time, in shadow mode first, observe, then flip the real gate — never both steps at once.

## The adapter: `checkWithShadow()`

`apps/web/lib/authorize-adapter.ts` (new, P1c, not called from anywhere yet). One function, two jobs:

1. Calls the real, unchanged `assertRole()` — its return value or thrown error is exactly what a direct `assertRole()` call would produce. This is the only thing that affects the caller.
2. In parallel, calls the new `authorize()` for an equivalent `PERMISSION_MATRIX_V1.md` permission string and returns a `shadowMismatch` describing any case where `assertRole()` allowed something `authorize()` would have denied. A shadow-check failure (a thrown error from `authorize()` itself, e.g. a transient query issue) is swallowed and reported as "no mismatch" — never propagated, never treated as a denial.

7 unit tests (`apps/web/lib/authorize-adapter.test.ts`) cover: real-gate fidelity (return value, thrown-error propagation, exact arguments passed to `assertRole()`), shadow agreement, shadow mismatch detection, and — the core safety property — that a shadow-check failure can never affect the real result.

**Migrating one call site**, once authorized, looks like:

```ts
// Before:
await requireProductionMember(productionId, ["Producer"]);

// Step A (this plan's unit of work) — behavior-identical, adds shadow logging:
const { membership, shadowMismatch } = await checkWithShadow({
  tx, userId: user.id, membership: rawMembership, allowedRoles: ["Producer"],
  productionId, equivalentPermission: "security.users.manage",
});
if (shadowMismatch) console.warn("[authz-shadow-mismatch]", shadowMismatch);

// Step B (a LATER, separately authorized change, only after Step A's shadow
// log has run clean for a real observation period) — the real cutover for
// this one call site:
const decision = await authorize(tx, user.id, "security.users.manage", { productionId });
if (!decision.allowed) throw new Error(`FORBIDDEN: ${decision.reason}`);
```

Step A is what this plan schedules, call site by call site, in the phase order below. Step B is out of scope for every phase listed here — it needs its own authorization once a phase's shadow data is reviewed.

## Complete call-site inventory

64 call sites across 28 files (`apps/web/lib/authz.ts`'s own 2 lines are the *implementation* of `requireProductionMember`/`requireCurrentProduction`, not call sites, and are excluded below). `production-actions.ts` uses `requireUser()` only — no production-membership check applies to creating a brand-new production.

| File | Call sites | What it gates | `PERMISSION_MATRIX_V1.md` domain |
|---|---:|---|---|
| `app/ai/actions.ts` | 6 | Trigger/approve AI suggestions, view log | `ai.*` |
| `app/money/actions.ts` | 5 | Expense/budget create, view, approve | `budget.*`, `expenses.*` |
| `app/locations/actions.ts` | 5 | Location CRUD | `locations.*` |
| `app/cast/actions.ts` | 5 | Cast CRUD | `cast.*` |
| `app/script/scene-actions.ts` | 4 | Scene CRUD | `script.*`, `breakdown.*` |
| `app/script/actions.ts` | 4 | Script edits | `script.*` |
| `app/documents/actions.ts` | 4 | Document upload/view/download/delete | `documents.*` |
| `app/script/import-actions.ts` | 3 | Script revision import | `script.import` |
| `app/schedule/shoot-day-actions.ts` | 3 | Shoot day CRUD | `schedule.*` |
| `app/overview/team-actions.ts` | 3 | Invite/remove member, change role (the **only** role-differentiated call sites today — `["Producer"]`) | `security.users.*` |
| `app/import/actions.ts` | 3 | Import pipeline | `script.import`, `breakdown.manage` |
| `app/crew/actions.ts` | 3 | Crew CRUD | `crew.*` |
| `app/wardrobe/page.tsx` | 1 | Page data fetch | `crew.view` (continuity data) |
| `app/shoot-day/page.tsx` | 1 | Page data fetch | `schedule.view`, `callsheet.view` |
| `app/shoot-day/call-sheet-actions.ts` | 1 | Call sheet edit | `callsheet.manage` |
| `app/settings/page.tsx` | 1 | Page data fetch | `production.manage` (view) |
| `app/script/page.tsx` | 1 | Page data fetch | `script.view`, `breakdown.view` |
| `app/schedule/page.tsx` | 1 | Page data fetch | `schedule.view` |
| `app/schedule/actions.ts` | 1 | Schedule edit | `schedule.manage` |
| `app/overview/page.tsx` | 1 | Page data fetch | production-wide view |
| `app/notifications-actions.ts` | 1 | Notification list | production-wide view |
| `app/money/page.tsx` | 1 | Page data fetch | `budget.view_summary` |
| `app/locations/page.tsx` | 1 | Page data fetch | `locations.view` |
| `app/documents/page.tsx` | 1 | Page data fetch | `documents.view` |
| `app/crew/page.tsx` | 1 | Page data fetch | `crew.view` |
| `app/contact-sheet/page.tsx` | 1 | Page data fetch | `crew.view`, `cast.view` |
| `app/cast/page.tsx` | 1 | Page data fetch | `cast.view` |
| `app/ai/page.tsx` | 1 | Page data fetch | `ai.log.view` |

Of these, **only `overview/team-actions.ts`'s two `["Producer"]` calls actually differentiate by role today** — every other call site accepts any production member regardless of role (`requireProductionMember(productionId)` with no second argument). This matters for prioritization: those two call sites are where a role/permission mismatch would have the most concrete, immediate consequence, and where shadow-mode observation is most valuable before any real cutover.

## Phased replacement order

The owner specified six phases; two more are added below to cover domains the inventory surfaced that weren't in the original list (**Phases 4 and 7**, marked explicitly) — flagged for review rather than silently folded into an existing phase.

Each phase is Step A only (add `checkWithShadow`, observe) — never Step B (flip the real gate) — per this plan's scope.

| Phase | Scope | Files | Why this order |
|---|---|---|---|
| **1 — Read-only, low-risk pages** | Every `page.tsx`'s `requireCurrentProduction()` call | 13 files (`overview`, `script`, `schedule`, `shoot-day`, `cast`, `crew`, `locations`, `contact-sheet`, `wardrobe`, `ai`, `documents`, `money`, `settings`) | Worst case of a wrong shadow signal here is a misleading log line — no mutation, no data at risk. Lowest possible stakes to validate the adapter itself against real traffic patterns. |
| **2 — Production settings** | `production-actions.ts` equivalents once they gate anything beyond creation (none do today — flagged as a placeholder, not a current call site) | — | Named by the owner; currently empty because production settings has no gated mutation yet beyond creation (which needs no prior membership). |
| **3 — Member management** | `overview/team-actions.ts` (3 call sites, including the only role-differentiated ones) | 1 file | Named by the owner as its own phase, and independently the highest-value phase to observe closely — see the inventory note above. |
| **4 — Core production content** *(added — not in the owner's original list)* | `cast/actions.ts`, `crew/actions.ts`, `locations/actions.ts`, `script/actions.ts`, `script/scene-actions.ts`, `script/import-actions.ts`, `import/actions.ts`, `schedule/actions.ts`, `schedule/shoot-day-actions.ts`, `shoot-day/call-sheet-actions.ts` | 10 files, 31 call sites | The bulk of the app's actual CRUD surface — no natural home in the owner's original 6 phases, so grouped here between Member management and Documents. Flagging for explicit confirmation this grouping/ordering is right, since it wasn't specified. |
| **5 — Documents** | `documents/actions.ts` | 1 file | Named by the owner. |
| **6 — Budget/cost areas** | `money/actions.ts` | 1 file | Named by the owner. |
| **7 — AI actions** *(added — not in the owner's original list)* | `ai/actions.ts` | 1 file, 6 call sites | A distinct domain (`ai.*`) not covered by the named phases; placed last among the current-app phases since AI suggestions are already gated by their own Suggest→Explain→Preview→Approve→Commit governance layer independent of role.
| **8 — Future logistics** | N/A — no Logistics code exists yet | — | Named by the owner as a placeholder for when Booking/Approval/Travel/Accommodation/Transport/Catering Server Actions are built (P4). |

## What "done" means for each phase (Step A only, this plan's scope)

1. Every listed call site's `requireProductionMember(...)`/`requireCurrentProduction()` call is replaced with the equivalent `checkWithShadow(...)` call, with the correct `equivalentPermission` (and `departmentId`, once department-scoped resources exist in real screens — none do yet).
2. Every `shadowMismatch` is logged (mechanism TBD when this is authorized — `console.warn` today, a structured Security Audit event once `AUDIT_EVENT_CATALOG.md`'s stream exists).
3. `pnpm test`/`typecheck`/`build` clean, exactly as required for every PR in this project.
4. **No user-visible behavior changes** — verified by the fact that `checkWithShadow`'s real-gate output is provably identical to `assertRole()`'s (see the adapter's own tests), not by manual spot-checking alone.
5. A follow-up period of real shadow-log observation (not part of this plan — an operational step for whoever runs the live app) before Step B for that phase is even proposed.

## Explicitly not in this plan

- Flipping any real gate from `assertRole()` to `authorize()` (Step B) — a separate, later authorization, per call site or per phase, once shadow data is reviewed.
- A structured audit-log destination for `shadowMismatch` records — `AUDIT_EVENT_CATALOG.md`'s Security Audit stream doesn't exist as real code yet (P3 in `IMPLEMENTATION_ROADMAP.md`'s original sequencing).
- Any change to `PERMISSION_MATRIX_V1.md`'s seeded role bundles — those are P1b's, already shipped in the stacked branch this PR sits on.
- Any live Supabase interaction of any kind.
