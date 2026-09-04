# Security & Access — Operations

See `docs/security/access-control/README.md` for the reading order.

## Phased delivery (owner's spec)

This module ships in explicitly separated, individually-authorized
phases, matching this migration train's established convention of
shipping schema ahead of the code that uses it:

- **Phase A (this phase)** — database + types + the pure `evaluateAccess()`
  policy engine. No Server Action, API route, QR generation/verification
  endpoint, or UI beyond minimal internal dev/test if necessary.
- **Phase B+** — Security Admin UI, Server Actions wiring reads/writes to
  the tables this migration created, QR generation, scanner PWA, presence,
  visitors, incidents UI, and the `/security-access` route (see
  `ARCHITECTURE_ACCESS_CONTROL.md`'s naming-collision note). Not started;
  requires new, explicit instruction to begin per the owner's own stated
  constraint.

## Deployment convention for this migration

`packages/db/migrations/0025_access_control_foundation.sql` ("P16")
follows the exact live-cutover convention every schema-bearing PR in this
session has used (P10 through P15): a self-contained
`docs/audits/P16_CUTOVER_SCRIPT.sql` plus
`docs/audits/P16_CUTOVER_INSTRUCTIONS.md`, hand-tested against real
Postgres 16 (happy path / already-applied abort / missing-prerequisite
abort / functional constraint checks), handed to the designated live-
cutover operator, and confirmed successful against production **before**
the PR is merged. Never applied directly against live Supabase from this
environment — this environment has no production credentials by design.

## What a future write-enabling phase needs to add

Every table in this migration is RLS-read-only today (see
`ARCHITECTURE_ACCESS_CONTROL.md`). Before any Server Action writes to any
of these tables, that PR needs to add:

- A narrowly-scoped INSERT/UPDATE/DELETE RLS policy for exactly the rows
  that Server Action is meant to write — never a blanket "any production
  member can write" policy, matching how this codebase already treats
  every other sensitive write path.
- Database-level cross-tenant checks stay as-is (the composite FKs already
  enforce them); the new policy only needs to add the *authorization*
  dimension (who is allowed to write, not just which production they're
  scoped to).

## Runbook items a later phase will need (not built yet)

- **Credential compromise response**: how fast a `REVOKED` status change
  propagates to devices with offline-cached policy data (depends on
  `OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md`, itself future work).
- **Device compromise response**: revoking a device's trust and what that
  means for any of its already-cached policy data.
- **Incident escalation**: `access_incidents.severity`/`status` exist as
  columns today, but no notification/escalation workflow is wired to them
  yet.
- **On-call ownership**: which team owns this module operationally once it
  has real write traffic — not yet decided, since Phase A ships no write
  traffic at all.

## Testing status as of Phase A

- `packages/db/migrations/0025_access_control_foundation.sql` applied
  cleanly on top of migrations 0000–0024 against a scratch Postgres 16
  database; all 15 tables created; a full valid insert chain succeeded; a
  cross-production composite-FK attack was rejected with the expected
  constraint-violation error; invalid enum values were rejected by their
  check constraints; `pg_policies` confirmed exactly one SELECT-only
  policy per table and RLS enabled on all 15.
- `packages/auth/src/access-control.ts` — 56 unit tests in
  `access-control.test.ts`, all passing, covering every reason code, the
  restrictions-override-grants precedence, anti-passback in all three
  modes, cross-production mismatches, and the mutation-safety/determinism/
  default-deny invariants.
- Repo-wide `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm --filter web typecheck` all pass with these changes included.
