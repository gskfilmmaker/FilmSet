# Security & Access — Audit Trail & Soft Delete

See `docs/security/access-control/README.md` for the reading order.

## Why this exists

Nothing before migration 0029 (P20) kept a trace of who changed what in this
module, and every `delete*` Server Action performed a real, permanent
database delete. For a module whose entire purpose is controlling and
proving who can go where, that's a real gap: an accidental (or malicious)
delete was unrecoverable, and no record existed of who created, edited, or
removed a credential, a grant, a restriction, or anything else in this
domain. This closes both gaps at once, following the intent of ISO/IEC
27001 A.8.15 and NIST 800-53 AU-2 — security-relevant events are recorded,
and that record is tamper-resistant — without inventing a bespoke mechanism
per table.

## Soft delete

Every table the Security & Access admin UI can delete a row from —
`access_identities`, `access_credentials`, `access_resources`,
`access_checkpoints`, `access_devices`, `access_profiles`,
`access_profile_rules`, `access_identity_profiles`, `access_grants`,
`access_restrictions`, `access_temporary_grants` — has nullable
`deleted_at timestamptz` / `deleted_by uuid references profiles(id)`
columns. A "delete" in the app (`apps/web/app/security-access/actions.ts`)
is an `UPDATE ... SET deleted_at = now(), deleted_by = <user>`, never a real
`DELETE FROM`. Every list query in `apps/web/app/security-access/page.tsx`
filters `where deleted_at is null`, so a soft-deleted row simply stops
appearing — it is never actually gone.

**Deliberate side effect, not a bug:** the existing UNIQUE constraints on
credential number, resource code, checkpoint code, and profile name were
**not** converted to partial/filtered indexes scoped to `deleted_at is
null`. That means a soft-deleted row's number/code/name can never be
reused by a new row — which is exactly the non-reuse guarantee
`docs/security/ID_NUMBERING_CONVENTION.md` already promises, now actually
enforced by the schema instead of merely documented as a policy.

Soft-deleted rows are not currently exposed anywhere in the UI (no
"show deleted" toggle, no restore action). Reversing a delete today means
directly clearing `deleted_at`/`deleted_by` on the row — the schema
supports it (nothing about a soft-deleted row prevents restoring it), but
no Server Action or UI does it yet. The `access_audit_log` `action` column
already has a `'RESTORE'` value reserved for exactly this, for whenever
that UI is built.

## The audit log

`access_audit_log` is one new, generic table — not one audit table per
domain table. Every create, update, or (soft) delete across every table in
this module writes one row here (`apps/web/lib/audit-log.ts`'s
`recordAudit()`, called from every Server Action in `actions.ts`):

| Column | Meaning |
|---|---|
| `production_id` | Tenancy — same `is_production_member()` RLS gate as every other table here. |
| `table_name` / `record_id` | Which row this describes. Plain text, **not** a foreign key — the row it describes may itself be soft-deleted by the time this is read, and a cascade-delete of the parent production removes this log entry too (an audit trail for a production that no longer exists has nothing left to audit). |
| `action` | `INSERT` \| `UPDATE` \| `DELETE` \| `RESTORE`. |
| `actor` | The `profiles.id` who did it. |
| `occurred_at` | Server timestamp, default `now()`. |
| `before` / `after` | Full-row JSONB snapshots. `before` is null on an `INSERT`; `after` is null on a `DELETE`. |

**Why this is tamper-resistant, not just a log:** RLS grants production
members exactly `SELECT` and `INSERT` on `access_audit_log` — there is no
`UPDATE` or `DELETE` policy, at all, for anyone. Nothing in the app can
edit or erase a row here once written; the only way this table's contents
change is by inserting new rows. This is what makes it an actual audit
trail rather than an editable activity feed.

**Where the write gate lives:** exactly where every other table in this
migration train already puts it — the app layer. Every function in
`actions.ts` that writes here is already behind `requireSecurityAdmin()`
(a Producer-role check); the audit log doesn't add a second authorization
mechanism, it just always fires alongside the mutation it's recording, in
the same `runAsUser` transaction (so a rolled-back mutation never leaves an
orphaned audit row, and a written mutation never lacks one).

## Relationship to `access_events`

`access_audit_log` and `access_events` are deliberately two different
tables with two different jobs, not the same idea twice:

- **`access_audit_log`** — who changed *the configuration* (a credential
  was edited, a grant was deleted, a profile was created) — the admin
  activity trail.
- **`access_events`** — the result of *a scan* (an identity presented a
  credential at a checkpoint and was allowed or denied) — the
  verification ledger, written by `verifyAccess()`
  (`apps/web/app/security-access/actions.ts`, see
  `ACCESS_POLICY_ACCESS_CONTROL.md`).

Migration 0025/0026 deliberately left `access_events` with no write RLS
policy, reserving it for "a future scan-verification endpoint" — this same
migration (0029) is the one that both adds that policy and ships the
endpoint that uses it. A scan decision is never written to
`access_audit_log` (that would duplicate `access_events`), and an admin
edit is never written to `access_events` (that would duplicate
`access_audit_log`).

## Security class split

Unrelated to audit/delete mechanically, but shipped in the same migration
because it touches the same tables: the combined `DIRECTOR_PRODUCER`
security/credential class is retired in favor of separate `DIRECTOR` and
`PRODUCER` classes — a Director and a Producer are different roles that
happened to share one "all access" tier before this; splitting them lets
each be reasoned about (and revoked) independently going forward, even
though today's badge styling still gives both the same "ALL ACCESS" gold
treatment (`credential-badge.tsx`). Any existing row using the retired
combined value is migrated to `PRODUCER` by the same migration, before its
CHECK constraint is tightened — see `packages/db/migrations/0029_audit_trail_soft_delete_class_split.sql`'s
header comment for why the constraint drop has to happen before, not
after, that data migration.
