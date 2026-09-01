# FilmSet — Security Architecture V1

**Audit deliverable 5 of 11.** Proposed design, not implementation. Covers Parts 6–13 and 16–18 of the audit mandate: the authorization engine itself, session security, MFA/SSO readiness, step-up authentication, and the Security Center UX (Users/Roles/Permissions/Sessions/Audit) built on top of it, including the Permission Simulator and Permission Change Preview. Read alongside `AUTHORIZATION_GAP_ANALYSIS.md` (what's missing and why) and `PERMISSION_MATRIX_V1.md` (the concrete permission vocabulary this engine evaluates).

---

## 1. The Authorization Engine — Single Decision Function

Everything below exists to support one function, called from every Server Action and every Server Component data fetch, replacing today's per-action `assertRole()` convention:

```
authorize(principal, action, resource) -> ALLOW | DENY(reason)
```

**Inputs considered** (Part 6), in evaluation order — cheapest/most-decisive checks first so a DENY short-circuits early:

1. **Session validity** — is this session active, not revoked, within its expiry?
2. **Membership status** — is the principal's `production_members` row (or `DepartmentMembership`, for department-scoped resources) `ACTIVE` right now, given `effectiveFrom`/`effectiveUntil` (`AUTHORIZATION_GAP_ANALYSIS.md` §7)?
3. **Role/permission grant** — does any role or direct permission grant the principal holds include `action` on `resource`'s type?
4. **Resource scope match** — does that grant's scope (production, department, specific resource) actually cover *this* resource instance?
5. **Resource sensitivity** — does the action require a sensitivity clearance (`view_sensitive` vs `view`) the principal doesn't hold (`PERMISSION_MATRIX_V1.md` §3)?
6. **Step-up requirement** — does this specific `action` require a recent strong-auth event (§5 below) the session doesn't currently have?

**Default**: DENY. A resource type with no matching grant is inaccessible, full stop — this inverts today's default, where an ungoverned table is accessible to any production member because RLS alone doesn't distinguish role (`AUTHORIZATION_GAP_ANALYSIS.md` §2).

**Implementation shape**: this is a single, testable, pure function (or a thin wrapper over one Postgres query using the RLS primitives already in place) — not fifty independent `if` blocks. RLS remains the tenant-isolation backstop underneath it (defense in depth: even if `authorize()` had a bug, cross-production data still can't leak, per today's real `is_production_member()` policies) but stops being the *only* enforcement layer for role/department/sensitivity, which it never was designed to be.

## 2. Session Architecture (Part 11)

```
Session
  id, userId, createdAt, lastActivityAt, expiresAt, revokedAt?,
  authMethod (password | passkey | oidc), mfaState (none | totp | passkey),
  riskState (normal | elevated), sourceIp, userAgent

SessionDevice
  sessionId, deviceLabel? (best-effort, from user agent — never claimed exact),
  firstSeenAt

AuthenticationEvent
  userId, sessionId?, type (login_success | login_failure | logout |
  password_reset | mfa_enrolled | mfa_challenge | new_device),
  timestamp, sourceIp, userAgent, result

SecurityEvent
  see AUDIT_EVENT_CATALOG.md — the superset stream AuthenticationEvent
  rows feed into
```

**Population strategy**: Supabase Auth already emits most of the underlying signals (login, logout, token refresh, MFA challenge) via its own event system — `Session`/`AuthenticationEvent` rows are populated by a listener on those events (a Supabase Auth webhook or the client-side `onAuthStateChange` hook, invoked server-side on the relevant Server Action/middleware path), **not** a parallel auth system. FilmSet does not reimplement session management; it observes and records Supabase's.

**User-visible surface**: "Active Sessions" under Settings/Security Center — list of `Session` rows for the current user, each revocable individually ("log out this device"). **Authorized admins** (holding `security.sessions.revoke` on the relevant production/org, per Part 6's requirement) can view and revoke sessions for other users within their authorization scope — never globally, and every such admin revocation is itself a `SecurityEvent`.

## 3. MFA / Passkey / SSO Readiness (Part 12)

| Capability | Supabase Auth support | FilmSet work required |
|---|---|---|
| TOTP / authenticator MFA | Yes (native `supabase.auth.mfa.*`) | New enrollment UI (Settings), challenge UI (login flow), `mfaState` tracking |
| Passkeys / WebAuthn | Yes (native) | Same shape as TOTP — new UI, no new crypto |
| Recovery codes | Supabase-issued at enrollment | Display/re-generation UI |
| Enterprise OIDC | Yes, per-project provider config | Org-level "connect your IdP" admin flow (new — no such concept exists today, since Organization itself doesn't exist yet, `AUTHORIZATION_GAP_ANALYSIS.md` §2) |
| SAML/SSO | Supabase Enterprise tier feature | Deferred — flagged as a later readiness item, not V1 |
| Org-enforced MFA | Not a Supabase primitive — must be app-enforced | New: a policy check in `authorize()` (§1) that denies session validity for org-mandated-MFA accounts without a satisfied `mfaState` |

**Constraint restated**: no custom cryptography anywhere in this plan — every capability above rides Supabase Auth's existing, audited primitives. FilmSet's job is UI, enrollment flow, and policy enforcement on top, not protocol implementation.

## 4. Step-Up Authentication (Part 13)

```
requiresStepUp(action) -> boolean   // static table, not per-call logic
stepUpSatisfied(session, action) -> boolean   // true if session's last
                                                // strong-auth event is
                                                // within a short window
                                                // (e.g. 5 minutes) AND
                                                // used a method meeting
                                                // the action's bar
```

**Actions requiring step-up** (seed list, extensible without code changes by editing the static table above, not by adding new `if` branches): changing a Production Super Admin, managing security permissions, exporting highly sensitive records, changing financial details, disabling MFA, generating mass exports, deleting/closing a production, creating privileged API credentials.

**UX**: a step-up-gated action that lacks a fresh strong-auth event prompts a re-authentication challenge (password re-entry, or MFA/passkey challenge) inline, then proceeds — never a silent block with no path forward, and never silently downgraded to "just let it through."

## 5. Security Center UX (Part 16)

`Administration → Security Center`, gated behind `security.*` permissions (so it's invisible to a principal who holds none of them — see role-adaptive workspace principle, `LOGISTICS_UX_SPEC.md` §2):

| Section | Backed by |
|---|---|
| Users | `production_members`/`DepartmentMembership` (org-scoped view for org admins) |
| Roles | Role templates + custom roles (§ `AUTHORIZATION_GAP_ANALYSIS.md` §3) |
| Permissions | `PERMISSION_MATRIX_V1.md`'s vocabulary, editable per role/custom-role |
| Departments | `Department`/`DepartmentHeadAssignment` (`LOGISTICS_DOMAIN_MODEL.md` §5) |
| Active Sessions | `Session` (§2) |
| Login History | `AuthenticationEvent` (§2) |
| Security Events | `SecurityEvent` (`AUDIT_EVENT_CATALOG.md`) |
| Audit Log | Production Audit + Security Audit streams (`AUDIT_EVENT_CATALOG.md`) |
| External Access | Vendor/External Viewer role grants — a filtered view of Users scoped to external role types |
| Shared Links | *(new concept — not designed here; flagged as needing its own spec if/when FilmSet adds shareable public links, which don't exist today)* |
| API/Integration Access | Privileged API credentials (Part 13's step-up-gated action) |
| Security Policies | Org-level policy toggles: enforced MFA, session timeout, IP allowlisting (future) |

**Filters** (Part 16): User, Date, Department, Event, IP, Device, Risk, Production — applied uniformly across Login History/Security Events/Audit Log, not reimplemented per section.

## 6. Permission Simulator (Part 17)

```
VIEW AS <user or role>
```

**Critical design constraint from the mandate, restated because it's easy to get wrong**: this must call the *exact same* `authorize()` function (§1) that production traffic uses — never a parallel "simulate what they'd see" approximation that can drift from real behavior. Concretely: the simulator renders the real UI/data by making the same server calls with the principal's context swapped, not a mocked/simplified copy.

**"Why does this user have access?"** — `authorize()`'s DENY/ALLOW decision (§1) already walks an ordered check list; the explain view is that same evaluation trace rendered for a human, e.g.:

```
Granted by: Production "Feature-Film-HOD Policy"
  Department = Costume
  Resource Department = Costume
  Membership: Active (since 2026-03-01)
```

This is a **byproduct of §1's design**, not new logic — `authorize()` should return its reasoning path alongside the decision even in production (cheaply — it's not extra database work, just structured output instead of a bare boolean), so the explain view has something real to render.

## 7. Permission Change Preview (Part 18)

Before a privileged permission change (adding/removing a role, editing a custom role's permission bundle) is committed:

```
previewChange(currentGrants, proposedGrants) -> {
  modulesGained: [...], modulesLost: [...],
  sensitiveResourcesGained: [...], sensitiveResourcesLost: [...],
  projectsAffected: [...], departmentsAffected: [...]
}
```

Computed by diffing `authorize()`'s resolvable-resource-set (§1) under the current grants vs. the proposed ones — again, reusing the real engine rather than a separate approximation. **Every privileged permission change, previewed or not, generates a Security Audit event** (`AUDIT_EVENT_CATALOG.md`) on commit — the preview is a UX safeguard, not a substitute for the audit trail.

## 8. What This Replaces, Concretely

| Today | V1 |
|---|---|
| `assertRole(membership, [...roles])` called (or forgotten) per Server Action | `authorize(principal, action, resource)` called once, centrally, before any Server Action body runs |
| `role: text` column, TS-union-validated only | Role/permission tables, DB-constrained, custom-role-capable |
| No department scope | `Department`/`DepartmentMembership`/`DepartmentHeadAssignment` (`LOGISTICS_DOMAIN_MODEL.md` §5) |
| No session visibility | `Session`/`SessionDevice`/`AuthenticationEvent` (§2) |
| No step-up | Static step-up table + `stepUpSatisfied()` (§4) |
| No audit beyond AI suggestions | Two-stream audit (`AUDIT_EVENT_CATALOG.md`) |

See `IMPLEMENTATION_ROADMAP.md` for how this is sequenced (P1 for §1 and role/permission foundations, P2 for §5's department layer once it lands, P3 for §2/§5/§6/§7's user-facing surfaces).
