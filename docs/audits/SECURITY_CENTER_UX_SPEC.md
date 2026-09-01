# Security Center / Audit UX Spec — P3

**Spec only — no code in this PR**, per the owner's explicit direction (the same "spec documents" answer that scoped P2). Grounded in `SECURITY_ARCHITECTURE_V1.md` §2 (Session Architecture), §5 (Security Center UX table), §6 (Permission Simulator), §7 (Permission Change Preview), and `AUDIT_EVENT_CATALOG.md`'s two-stream event catalog — all three already-approved designs, none of which have shipped as schema or code yet. This spec is the UI blueprint for when they do; it invents no new events, no new tables, no new permissions.

**Not buildable yet — more so than P2.** `DEPARTMENT_UX_SPEC.md`'s screens were blocked on wiring `authorize()`, which at least exists (P1b/P1c). Everything below is also blocked on tables and event-emission code that don't exist yet at all: `Session`/`SessionDevice`/`AuthenticationEvent` (`SECURITY_ARCHITECTURE_V1.md` §2), and the Production Audit / Security Audit streams (`AUDIT_EVENT_CATALOG.md`). This spec assumes those are built as designed; it is not itself that build.

---

## 1. Security Center IA

`Administration → Security Center`, per `SECURITY_ARCHITECTURE_V1.md` §5 — a distinct top-level area, not folded into `Settings` the way Departments is (P2 §1). Two reasons this is a different call than P2's, not an inconsistency:

- **Scope**: Departments is production configuration; Security Center spans sessions, audit trails, and org-level policy — some of it (Security Audit, per `AUDIT_EVENT_CATALOG.md` §5) is explicitly *not* production-scoped at all, so it cannot live inside a per-production Settings page the way Departments can.
- **Visibility gating**: `SECURITY_ARCHITECTURE_V1.md` §5 requires the entire area be invisible to a principal holding none of the `security.*` domain — matching `LOGISTICS_UX_SPEC.md` §2's role-adaptive workspace principle. A nav entry that's usually absent reads better as its own top-level item (present only for the minority who need it) than as a Settings tab that's sometimes missing.

```
Administration
└─ Security Center                    (NEW — this spec, gated on any security.* permission)
   ├─ Users                            (§2 below — production_members / DepartmentMembership)
   ├─ Roles & Permissions              (§2 — role/permission tables, PERMISSION_MATRIX_V1.md)
   ├─ Active Sessions                  (§3)
   ├─ Login History                    (§2 — AuthenticationEvent)
   ├─ Security Events                  (§2 — SecurityEvent / Security Audit stream)
   ├─ Audit Log                        (§2 — Production Audit stream)
   ├─ Permission Simulator             (§4)
   └─ Security Policies                (out of scope here — org-level toggles, flagged §6)
```

Reached via `Tabs` (`packages/ui`) across the sub-sections, same pattern as `DEPARTMENT_UX_SPEC.md` §1's Settings tabs and `Settings`'s own General/Team split — one page, sectioned, not eight separate routes.

## 2. Event catalog → screen mapping

`AUDIT_EVENT_CATALOG.md`'s two streams are the data; this section is where each stream's rows actually surface, and with what filters. `SECURITY_ARCHITECTURE_V1.md` §5 specifies one uniform filter set (User, Date, Department, Event, IP, Device, Risk, Production) reused across all three log-shaped sections below — not reinvented per screen.

| Screen | Source | What it shows | Notes |
|---|---|---|---|
| **Login History** | `AuthenticationEvent` (§2) | `auth.login_success`/`auth.login_failure`/`auth.logout`/`auth.new_device` rows for the user (self-view) or, for `security.audit.view` holders, any user in scope | The one section an ordinary user sees about *themselves* without holding any `security.*` permission — "did I actually log in from that IP" is a self-service question, not an admin one. Self-view has no filters; the admin cross-user view gets the full filter set. |
| **Security Events** | `SecurityEvent` / Security Audit stream (§3) | `mfa.*`, `role.changed`/`permission.changed`, `authorization.denied`, `session.revoked`, `export.bulk`, `file.sensitive_download`, `api_credential.*`, `production.deleted` | `security.audit.view`-gated, full stop — per `AUDIT_EVENT_CATALOG.md` §3's "visible only to `security.audit.view` holders." `authorization.denied` rows are the highest-volume, lowest-drama entries here (every `authorize()` DENY, including routine ones) — deserves its own sub-filter to separate "someone probing" from "someone clicked a link they don't have access to," rather than drowning the section. |
| **Audit Log** | Production Audit stream (§2) | `scene.moved`, `booking.*`, `budget.po_approved`, `document.*`, `cast.updated`/`crew.updated`, `department.hod_assigned`, etc. | Production-scoped, visible to that production's leadership per `AUDIT_EVENT_CATALOG.md` §2 ("not a security-team-only surface") — a materially wider audience than Security Events, and the screen's default filter state should reflect that (defaults to the current production, no cross-production view unless the viewer also holds org-level access). |

**Before/after diffs** (`AUDIT_EVENT_CATALOG.md` §4): both Security Events and Audit Log rows that represent a mutation expand to show `beforeState`/`afterState` inline (a `DropdownMenu`-triggered detail panel, or a `Drawer` for the full diff — `Drawer` already exists and is the right primitive for "more detail without leaving the list," matching its established use elsewhere). A field classified `CONFIDENTIAL`+ shows as "(changed)" rather than its value to a viewer below `view_sensitive` clearance — this is a rendering rule, not a filtering rule; the row itself stays visible, only the value is withheld, per §4's explicit "not become a side-channel" requirement.

**Users / Roles & Permissions**: `SECURITY_ARCHITECTURE_V1.md` §5 lists these as their own sections; they are not designed in this document. Departments' equivalent (`DEPARTMENT_UX_SPEC.md` §2's Directory, §5's Permission Preview) already covers the department-scoped slice; a production-wide Users/Roles admin screen is real, separate design work this spec explicitly does not do — flagged as a gap, matching how P2 flagged the temporal-access UI gap in its own §3.

## 3. Active Sessions screen

Direct implementation of `SECURITY_ARCHITECTURE_V1.md` §2's "user-visible surface" line.

```
┌──────────────────────────────────────────────────────────────────┐
│  Active Sessions                                                  │
├──────────────────────────────────────────────────────────────────┤
│  This device · Chrome on macOS              Mumbai, IN            │
│  Active now                                          [this session]│
├──────────────────────────────────────────────────────────────────┤
│  iPhone · Safari                              Mumbai, IN           │
│  Last active 2 hours ago                             [Log out]    │
├──────────────────────────────────────────────────────────────────┤
│  Chrome on Windows                            Delhi, IN            │
│  Last active 3 days ago                               [Log out]   │
└──────────────────────────────────────────────────────────────────┘
```

- One row per `Session` (§2) for the current user — `deviceLabel` (explicitly "best-effort, never claimed exact" per the architecture doc) plus `lastActivityAt` and `sourceIp`-derived rough location (city/country only — the architecture never claims precise geolocation, and this spec doesn't either).
- The current session is visually distinguished and has no "Log out" action (can't revoke the session rendering the page).
- **"Log out" is immediate and irreversible** — no confirmation `Dialog` needed for a user revoking their *own* session (low stakes, easily undone by logging back in), unlike an admin revoking someone *else's* session below.
- **Admin view** (`security.sessions.revoke` holders, §2): the same screen, scoped to a chosen user via the Users section, gets a confirmation `Dialog` before revoke ("Log out [Name]'s Chrome on Windows session?") — higher stakes, not self-service, and — per §2 — itself fires a `session.revoked` Security Event with `admin-initiated` recorded, which the confirmation copy should say plainly ("This will be recorded in the Security Audit log").
- **Empty/loading states**: `EmptyState`/`Skeleton`, same as every other list screen (P2 §2 sets this precedent).

## 4. Permission Simulator

Direct implementation of `SECURITY_ARCHITECTURE_V1.md` §6, and the completion of the "View as HOD" skeleton `DEPARTMENT_UX_SPEC.md` §6 deliberately deferred here.

### 4.1 Entry points

Two, both landing on the same underlying mechanism:

1. **General**: `Security Center → Permission Simulator` — a user/role picker (`Select`, existing primitive), open to anyone holding a Security Center-visible `security.*` permission that includes simulation (exact permission key TBD when `PERMISSION_MATRIX_V1.md` is next revised — flagged, not invented here).
2. **Contextual**: `DEPARTMENT_UX_SPEC.md` §6's "View as HOD" button on a department's Membership screen — the same simulator, pre-filled with that department's current HOD and no picker shown. A contextual entry point is a pre-filled invocation of the general mechanism, not a second implementation.

### 4.2 The critical constraint (restated because it's the one thing this feature cannot get wrong)

Per `SECURITY_ARCHITECTURE_V1.md` §6: the simulator calls the real `authorize()` function and the real data-fetching Server Actions/Server Components with the principal swapped — **never** a parallel "what would they see" approximation. Concretely, this means the simulator is not a new set of screens; it is the *existing* app screens (Overview, Schedule, Crew, Money, etc.) rendered with the simulated principal's session context, inside the same banner-wrapped shell. If a future engineer is tempted to build a faster, mocked simulator "just for this view," that is the one thing this spec forbids — the entire value of the feature is that it cannot drift from real behavior.

### 4.3 Visual treatment

Persistent banner, not a modal — the simulating user navigates real screens while the simulation is active (`DEPARTMENT_UX_SPEC.md` §6 fixed this already; restated here since it's this section's actual home):

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 Viewing as Priya Sharma — Wardrobe HOD              [Exit]    │
└──────────────────────────────────────────────────────────────────┘
[ ... real app screen, rendered with the simulated principal ... ]
```

- Fixed to the top of the viewport, above the app's existing top bar — always visible regardless of scroll, so a simulating admin can never lose track of the fact that they're not looking at their own view.
- **All write actions are disabled while simulating** — every mutating control (buttons, forms, row-menu actions) renders in a disabled state with a tooltip ("Disabled while viewing as another user") rather than being hidden, so the simulating admin can still see *that* a control exists (part of what they're checking) without being able to trigger it. This is a UI-layer disable, not a substitute for `authorize()` itself denying the write — belt-and-suspenders, matching the "defense in depth" framing `SECURITY_ARCHITECTURE_V1.md` §1 uses for RLS underneath `authorize()`.
- `[Exit]` is the only always-available action in the banner, returning to the admin's own session context immediately.

### 4.4 "Why can this user access this?"

The explain view, per `SECURITY_ARCHITECTURE_V1.md` §6: `authorize()`'s decision is designed to return its reasoning trace alongside the ALLOW/DENY boolean, "even in production... not extra database work, just structured output." This spec's job is only to render that trace, not to compute it.

```
┌──────────────────────────────────────────────────────────────────┐
│  Why can Priya Sharma view Wardrobe budget detail?                │
├──────────────────────────────────────────────────────────────────┤
│  ✓ Granted                                                        │
│                                                                    │
│  Granted by: Department Head assignment                           │
│    Department = Wardrobe                                          │
│    Resource Department = Wardrobe                                 │
│    Membership: Active (since 2026-08-01)                          │
│                                                                    │
│  Permission: budget.view_detail                                   │
│  Source: department_head_assignments (not the Coordinator role    │
│  bundle — HOD-only permissions are never granted by role,         │
│  see packages/auth/src/authorize.ts)                              │
└──────────────────────────────────────────────────────────────────┘
```

- Available as a `Dialog` (existing primitive) from two places: (a) inline, next to any permission-gated element, for a self-check ("why can I do this"), and (b) from the Permission Simulator, for an admin checking on someone else's behalf — same rendering, different subject.
- **A DENY explanation follows the same shape**, just with the failing check surfaced instead of the granting one — e.g. "Membership status: SUSPENDED (as of 2026-08-20)" or "No grant includes permission 'budget.view_detail'" (the literal `evaluateAuthorization()` deny-reason strings already exist in `packages/auth/src/authorize.ts` — P1b — and are exactly the right level of detail for this view; this spec does not need to invent new reason text once wiring makes them reachable).
- This view is the department-scoped Permission Preview's (`DEPARTMENT_UX_SPEC.md` §5) natural companion: §5 answers "what can a Coordinator do, in general"; this answers "why can *this specific person* do *this specific thing*, right now." Both read the same underlying grant data; neither is a hand-maintained description.

## 5. Permission Change Preview — not designed here

`SECURITY_ARCHITECTURE_V1.md` §7 specifies `previewChange()` as a diff over `authorize()`'s resolvable-resource-set, shown before a privileged permission change commits. This is real, separate screen design (the Roles & Permissions editor it belongs to doesn't have a spec yet either, per §2's note above) — flagged as explicitly out of scope for this document rather than sketched thinly. What's fixed by §7 already and worth restating: every permission change generates a Security Audit event on commit **whether or not the preview was shown or heeded** — the preview is a UX safeguard, not the audit trail's source of truth.

## 6. What's explicitly not in this spec

- **Security Policies** (org-level MFA/session-timeout/IP-allowlisting toggles, `SECURITY_ARCHITECTURE_V1.md` §5's last row) — a policy-configuration screen, not an audit/session-viewing one; different design problem, not sketched here.
- **MFA/passkey enrollment UI** (§3 of the architecture doc) — login-flow and Settings work, not Security Center work; out of this document's scope.
- **The Roles & Permissions editor** and a production-wide **Users** admin screen (§2's flagged gap above).
- **Shared Links** and **API/Integration Access** — both explicitly flagged in `SECURITY_ARCHITECTURE_V1.md` §5 itself as needing their own future spec ("not designed here").
- Any schema, migration, Server Action, or React code — this document, no more than `DEPARTMENT_UX_SPEC.md`, ships none.

## 7. What ships when

- **Blocked on**: `Session`/`SessionDevice`/`AuthenticationEvent` tables and the Supabase Auth event listener that populates them (§2), and both audit streams actually emitting events (`AUDIT_EVENT_CATALOG.md`) — none of which exist yet. This is a harder prerequisite than P2's (which only needed `authorize()` wired, and the tables already existed from P1b).
- **Sequencing relative to P2**: independent in data (Departments schema vs. Session/Audit schema are unrelated), but the Permission Simulator's contextual "View as HOD" entry point (§4.1) has a soft dependency on `DEPARTMENT_UX_SPEC.md` §3 (the Membership screen it launches from) existing first — the general entry point (Security Center's own picker) has no such dependency and could ship independently.
- **Read-only-first slice, same reasoning as P2 §7**: Login History (self-view) and the explain view (§4.4) are the two lowest-risk, highest-immediate-value pieces if built incrementally — neither writes anything, and both answer questions a user or admin actually asks today with no good answer ("did I really log in from there," "why can't I see this").
