# FilmSet — Audit Event Catalog

**Audit deliverable 9 of 11.** Covers Parts 14–15 of the audit mandate: the two required audit streams, their common record shape, the specific event catalog for each, and the immutability design. Today's only audit-adjacent table, `ai_suggestion_log` (`packages/db/src/schema.ts:576`), covers a narrow slice of what's below (AI suggestion + decision only) — it is not replaced by this design, it becomes one *source* feeding the Production Audit stream's AI-related events.

---

## 1. Common Record Shape

Every audit record, in either stream, answers the same eight questions (Part 14):

| Field | Answers | Notes |
|---|---|---|
| `actorId` | WHO | The authenticated user, or a system/service identity for automated events |
| `action` | WHAT | A permission-vocabulary action or event type (`PERMISSION_MATRIX_V1.md` §1, or the catalogs below) |
| `occurredAt` | WHEN | Server-assigned timestamp, never client-supplied |
| `sessionId` | WHERE/SESSION | Links to `Session` (`SECURITY_ARCHITECTURE_V1.md` §2) — connects an action back to the session/device/IP it happened from |
| `productionId` | WHICH PRODUCTION | Null only for org- or platform-level events |
| `resourceType` / `resourceId` | WHICH RESOURCE | e.g. `booking` / `bkg_123` |
| `result` | RESULT | `success` \| `denied` \| `error` |
| `source` | SOURCE | `web_app` \| `server_action` \| `system_job` \| `api` (the last two are forward-looking — no background jobs or external API exist yet, per `CURRENT_ARCHITECTURE_MAP.md` §2) |
| `beforeState` / `afterState` | — | Structured diff, where the event represents a change (§4) |

## 2. Stream A — Production Audit

Operational changes to production data. High volume, production-scoped, generally visible to that production's own leadership (not a security-team-only surface).

| Event | Example resourceType |
|---|---|
| `scene.moved` | `scene` |
| `schedule.call_changed` | `shoot_day` |
| `booking.created` / `booking.changed` / `booking.cancelled` | `booking` (any `BookingType`, `LOGISTICS_DOMAIN_MODEL.md` §0.1) |
| `accommodation.room_changed` | `room_assignment` |
| `movement.reassigned` | `movement_leg` |
| `wardrobe.look_updated` | `continuity_note` |
| `budget.po_approved` | `expense` / `commitment` |
| `document.uploaded` / `document.deleted` | `document` |
| `cast.updated` / `crew.updated` | `cast_member` / `crew_member` |
| `ai.suggestion.created` / `ai.suggestion.approved` / `ai.suggestion.rejected` | `ai_suggestion_log` row — **this is where today's existing table plugs in directly** |
| `department.hod_assigned` | `department_head_assignment` |

## 3. Stream B — Security Audit

Identity, access, and system-integrity events. Lower volume, cross-production-aware, visible only to `security.audit.view` holders.

| Event | Notes |
|---|---|
| `auth.login_success` / `auth.login_failure` | Sourced from Supabase Auth events (`SECURITY_ARCHITECTURE_V1.md` §2) |
| `auth.logout` | |
| `auth.new_device` | First `SessionDevice` seen for a user |
| `mfa.enrolled` / `mfa.challenge` / `mfa.disabled` | `mfa.disabled` is also step-up-gated (`SECURITY_ARCHITECTURE_V1.md` §4) — both events fire |
| `role.changed` / `permission.changed` | Fires from `SECURITY_ARCHITECTURE_V1.md` §7's Permission Change Preview commit step |
| `authorization.denied` | Every `authorize()` DENY, not just ones a user might notice — this is the signal that catches probing/misconfiguration |
| `session.revoked` | Includes whether self-initiated or admin-initiated |
| `export.bulk` | Any `export`/`download_original` crossing a size/count threshold (defined alongside the step-up table, `SECURITY_ARCHITECTURE_V1.md` §4) |
| `file.sensitive_download` | A `download_original` on a `CONFIDENTIAL`+ classified document (`PART 9`, referenced in `AUTHORIZATION_GAP_ANALYSIS.md` §6) |
| `api_credential.created` / `api_credential.revoked` | Step-up-gated |
| `production.deleted` | Step-up-gated, and — per Part 15 — **cannot be the last audit event a Production Super Admin can erase**; see §5 |

## 4. Before/After Diffs

Where an event represents a mutation (`booking.changed`, `role.changed`, `document.deleted`, etc.), `beforeState`/`afterState` capture a structured diff of the changed fields only — not a full row snapshot on every event (storage cost, and most fields didn't change). Fields classified `CONFIDENTIAL`+ (Part 9) are diffed by presence/absence of a change, not by value, in any audit view below `security.audit.view` with elevated sensitivity clearance — the audit log must not become a side-channel that leaks a sensitive value to someone who couldn't `view_sensitive` it directly.

## 5. Immutability (Part 15)

Audit records are **not** normal editable application rows:

- **Separate schema/tables**, not co-located with production data tables — a different migration surface, reviewed with different scrutiny.
- **Restricted database permissions**: the `authenticated` role (what the app connects as via `runAsUser`, `CURRENT_ARCHITECTURE_MAP.md` §4) gets `INSERT`-only grants on audit tables — no `UPDATE`, no `DELETE`, enforced at the Postgres grant level, not just in application code. Only a separate, break-glass-audited privileged path (not the app's normal connection) could ever touch a written audit row, and that path is itself logged.
- **Immutable archive**: periodic export to write-once storage (e.g. object storage with retention lock) as a hardening step beyond the DB-grant restriction — proposed for `P10` in `IMPLEMENTATION_ROADMAP.md`, not V1.
- **Retention policy**: defined per stream (Security Audit typically retained longer than Production Audit) — exact durations are a policy decision for the production/org owner, not fixed here; the architecture supports whatever retention policy is chosen without a schema change (retention is a scheduled prune job against `occurredAt`, not a structural constraint).
- **Integrity verification / hash chaining**: flagged as future hardening (Part 15 explicitly lists this as "consider," not "require") — each record's hash could include the previous record's hash, making silent tampering detectable. Proposed for `P10`, not V1, since it adds real complexity for a benefit that matters most once FilmSet is pursuing the certifications named in `CONTENT_SECURITY_ROADMAP.md`.
- **Explicit guarantee**: a Production Super Admin — even one with `production.delete` — cannot erase their own Security Audit trail. Deleting a production archives/soft-deletes production data; it does not touch the Security Audit stream, which is org-scoped, not production-scoped, for exactly this reason.

## 6. What This Replaces

`ai_suggestion_log` stays exactly as it is structurally (no breaking change to the AI governance pipeline) but becomes one populated source among many for Stream A, rather than the only audit trail in the system. No other table today records any of the events in §2 or §3 — this catalog is new construction, not a migration of existing data.
