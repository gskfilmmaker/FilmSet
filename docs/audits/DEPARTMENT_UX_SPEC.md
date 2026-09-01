# Department Foundation UX Spec — P2

**Spec only — no code in this PR**, per the owner's explicit direction: P2/P3 are design/IA documents, matching the treatment `LOGISTICS_UX_SPEC.md` already gave Logistics and `LOGISTICS_DOMAIN_MODEL.md` §4 gave the Control Center. Grounded in the schema P1b actually shipped (`departments`, `department_memberships`, `department_head_assignments`, `department_permissions`, `department_budget_scopes` — `packages/db/migrations/0017_authorization_foundation.sql`) and FilmSet's existing FRAME design system (`packages/ui`) — this spec reuses real, already-built primitives rather than inventing new ones.

**Not buildable yet.** Every screen below reads data through `authorize()`/`apps/web/lib/authorize.ts` (P1b) — unwired — and needs its own Server Actions, which don't exist. This spec is the blueprint for when that wiring is separately authorized (`AUTHORIZATION_WIRING_PLAN.md`), not a description of something already running.

---

## 1. Where this lives in the app

Today's `Settings` page (`apps/web/app/settings/page.tsx`) is a single form (production name/phase, user profile). The natural home for department management is a new `Settings → Departments` sub-area, not a top-level sidebar item — departments are production configuration, the same category as the settings that already live there, not a daily-use production module like Schedule or Cast.

```
Settings
├─ General          (existing — production name/phase, profile)
├─ Team              (existing functionality, today unlabeled — overview/team-actions.ts's
│                      invite/remove/role-change, which has no dedicated screen today;
│                      this spec assumes it gets one as part of the same settings
│                      restructure, not a new department-specific requirement)
└─ Departments        (NEW — this spec)
   ├─ Directory                    (§2)
   ├─ [Department] → Membership    (§3)
   ├─ [Department] → HOD           (§4, folded into Membership, not a separate route)
   └─ [Department] → Permissions   (§5)
```

Reached via `Tabs` (`packages/ui`'s existing `Tabs` primitive, the same pattern `Settings` would use for General/Team/Departments) rather than new sidebar entries — matches how Settings already reads as one page with sections, not a new nav concept.

## 2. Department Directory

The landing screen for `Settings → Departments`. One row per `departments` row for the current production (25 seeded per production by `0017`'s backfill — Production, Camera, Grip & Electric, Sound, Art, Props, Wardrobe, Hair & Makeup, Locations, Stunts, Transportation, Logistics, Catering, Post-Production, Visual Effects, Special Effects, Set Decorating, Casting, Construction, Medic, Accounting, Video/Playback, Animals, Publicity, Additional Labor).

```
┌──────────────────────────────────────────────────────────────────┐
│  Departments                                    [+ New Department]│
├──────────────────────────────────────────────────────────────────┤
│  Department          │  Head              │  Members  │  Status   │
├──────────────────────┼────────────────────┼───────────┼───────────┤
│  Camera               │  — Unassigned —    │  0         │ ⚠ No HOD │
│  Wardrobe              │  Priya Sharma      │  3         │           │
│  Sound                 │  — Unassigned —    │  0         │ ⚠ No HOD │
│  Catering               │  Ravi Kumar        │  2         │           │
│  ...                    │                    │            │           │
└──────────────────────────────────────────────────────────────────┘
```

Built on `packages/ui`'s `DataTable` (the same primitive `Crew`/`Cast`/`Locations` already use) — no new table component needed. The "No HOD" state uses `StatusBadge`'s existing `warning` tone, matching `Crew`'s own established "needs a department head" gap-check (`apps/web/app/crew/crew-section.tsx`, `AUTHORIZATION_GAP_ANALYSIS.md` §5's cited today's-closest-equivalent) — this screen is the first-class version of a check that already exists as a lesser, display-only signal.

**Empty/loading states**: `EmptyState`/`Skeleton` (existing primitives), matching every other list screen in the app — no new pattern.

**Row click** → Membership screen (§3) for that department.

## 3. Department Membership screen

One department's roster — `department_memberships` rows for this `departments.id`, joined against `profiles` for display name.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Departments   /   Wardrobe                                     │
├──────────────────────────────────────────────────────────────────┤
│  Head of Department                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  👤 Priya Sharma                          [Change HOD ▾]    │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Members                                          [+ Add Member]  │
├──────────────────────┬──────────────────┬────────────┬───────────┤
│  Name                 │  Role             │  Since      │           │
├──────────────────────┼──────────────────┼────────────┼───────────┤
│  Priya Sharma          │  Department Head   │  2026-08-01│  [···]    │
│  Anjali Verma           │  Coordinator        │  2026-08-15│  [···]    │
│  Rohan Das              │  Member             │  2026-08-15│  [···]    │
└──────────────────────────────────────────────────────────────────┘
```

- **Head of Department** card is always the top section — reads from `department_head_assignments`, not from whoever happens to hold a "Department Head"-named row in `department_memberships` (the two are related but distinct: P1b's `authorize()` grants `departments.manage`/`departments.assign_hod` *only* from `department_head_assignments`, never from a role name — see `packages/auth/src/authorize.ts`'s doc comment. This screen's "Change HOD" action is the one place the app should write that table directly, once built).
- **§4, HOD assignment**, folded in here as the "Change HOD" dropdown/dialog rather than a separate route — HOD assignment is one action on one department, not a workflow big enough to warrant its own screen. Opens a `Dialog` (existing primitive) listing current `department_memberships` for this department (an HOD should ordinarily already be a member — the dialog can offer "add as member and assign HOD" in one step for someone not yet listed, rather than forcing two separate actions).
- **Members table**: role column shows the `department_memberships.role_id` → `roles.name` (e.g. "Coordinator," "Member" — the P1b-seeded `role_department_coordinator`/`role_department_member` templates). Row menu (`DropdownMenu`, existing) offers role change / remove.
- **`effectiveFrom`/`effectiveUntil`** (P1b's temporal-access columns) are deliberately not surfaced in this first-cut table — worth a "Since" column reading `effectiveFrom` where set, but a wrapped-crew-member expiry UI is real, separate design work (`AUTHORIZATION_GAP_ANALYSIS.md` §7's full temporal-access UX), flagged here as a known gap rather than designed now.

## 4. HOD assignment — folded into §3, not a separate screen

See "Change HOD" above. Restated because the owner's original scope named it as its own item: after review, a standalone screen for a single dropdown/dialog action would be over-built relative to what it does — the dialog *is* the HOD assignment UI, launched from the Membership screen where the HOD is already the top section.

## 5. Department Permission Preview

A read-only view answering "what does this department's role structure actually grant, today" — the department-scoped analog to `SECURITY_ARCHITECTURE_V1.md` §7's Permission Change Preview, and a direct UX payoff of P1b's `department_permissions`/role-bundle design being real, structured data instead of implicit convention.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Wardrobe   /   Permissions                                     │
├──────────────────────────────────────────────────────────────────┤
│  Department Head                                                  │
│    ✓ Manage this department, assign HOD  (via HOD record — see ⓘ)│
│    ✓ View budget detail for Wardrobe                              │
│    ✓ View/manage schedule, call sheets, crew, cast, locations,    │
│      documents (production-wide — not department-scoped)          │
├──────────────────────────────────────────────────────────────────┤
│  Coordinator                                                      │
│    ✓ Same visibility as Head                                      │
│    ✗ Cannot manage department or reassign HOD                     │
├──────────────────────────────────────────────────────────────────┤
│  Member                                                            │
│    ✓ View schedule, call sheets, crew, cast, locations             │
│    ✗ No department-management or budget-detail access              │
└──────────────────────────────────────────────────────────────────┘
```

- Grouped by role, not by permission — matches how `PERMISSION_MATRIX_V1.md` §4 itself is organized (tier → bundle), and answers the question a Producer configuring departments actually has ("what can a Coordinator do") rather than a flat, harder-to-scan permission list.
- The `ⓘ` on "Manage this department, assign HOD" surfaces the real mechanism — `packages/auth/src/authorize.ts`'s doc comment explains this is granted from `department_head_assignments`, never a role bundle — via `Tooltip` (existing primitive), matching `SECURITY_ARCHITECTURE_V1.md` §6's Permission Simulator explain-view principle ("Granted by: ...") at a smaller scale.
- **This screen reads `role_permissions` directly** (the same table `evaluateAuthorization()` reads) — not a hand-maintained description of what each role does. If a future PR edits the seeded bundles, this screen updates with zero code change, by construction.

## 6. "View as HOD" — design skeleton

Full spec deferred to P3 (`SECURITY_ARCHITECTURE_V1.md` §6's Permission Simulator is the general mechanism; a department-scoped "View as this department's HOD" is one specific invocation of it, not a separate feature). What's fixed here, since P2 named it explicitly:

- **Entry point**: a "View as HOD" action on the Membership screen's Head-of-Department card (§3), pre-filled with that department's current HOD — not a general user-picker (that's the full Permission Simulator, P3's scope).
- **Critical design constraint, inherited from `SECURITY_ARCHITECTURE_V1.md` §6 and restated because it's easy to get wrong**: this must call the real `authorize()`/data-fetching path with the principal swapped, never a mocked/simplified approximation — the whole point is showing what that HOD's screens *actually* look like, department-scoped budget and all.
- **Visual treatment**: a persistent banner (not a modal, since the user navigates real screens while simulating) — "Viewing as [Name], Wardrobe HOD — [Exit]" — matching the tone of a browser's "you are impersonating" banners elsewhere in the industry, not hidden in a settings toggle.
- Full interaction detail (what happens to write actions while simulating — almost certainly disabled/read-only, matching a simulator's purpose) is P3 scope, since it's really one feature with the general Permission Simulator, department-scoped or not.

## 7. What ships when

- **Blocked on** P1b's `authorize()` actually being wired into `apps/web` (`AUTHORIZATION_WIRING_PLAN.md`) — every screen above needs real permission data, and none of it should be built against `assertRole()`'s flat role check, which can't express department scoping at all.
- **Independent of** Logistics (P4) — departments are a production-wide concept Logistics roles (Travel Coordinator, Transport Coordinator, Catering Head) will *use*, not something Logistics needs to exist first, matching `AUTHORIZATION_GAP_ANALYSIS.md` §11's dependency chain (Role/Permission Model → Department Scoping → Logistics-role permissions).
- **The Directory (§2) and Permission Preview (§5) are read-only** and could ship before any write UI (§3's Add Member/Change HOD, §6's View as HOD) — a reasonable first slice if this is built incrementally rather than all at once, though sequencing that is a build-time decision, not fixed by this spec.
