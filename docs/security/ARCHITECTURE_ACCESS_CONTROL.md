# Security & Access — Architecture

See `docs/security/access-control/README.md` for the reading order and the
`/security` naming-collision note. This doc covers the data model built in
`packages/db/migrations/0025_access_control_foundation.sql` ("P16") and its
Drizzle mirror in `packages/db/src/schema.ts`.

## Design constraints (from the owner's spec)

- **Generic, not film-specific.** Every table/column name is domain-neutral
  (identity, credential, resource, checkpoint, device, access event) so this
  core is reusable outside a film-production context. Film-specific
  concepts (Wrap Check, call-sheet readiness) belong in a future app-layer
  adapter, never in this schema.
- **No independent duplicate personnel database.** `access_identities` is a
  thin wrapper around the *existing* `cast_members`/`crew_members` records
  (or, for people with no existing FilmSet record, an EXTERNAL case) — it
  never re-stores a name/contact/department that already lives elsewhere.
- **Do not rewrite existing authentication, weaken existing RLS, bypass
  organization isolation, or replace the existing design system.**

## Tenancy

Every table carries `production_id` only — never a redundant
`organization_id` — exactly matching every other production-scoped table
in this schema (`cast_members`, `crew_members`, `locations`, `vehicles`,
...). A production's organization is always reachable via
`productions.organization_id`. A device or identity spanning multiple
productions within one organization is real future-product territory, but
is explicitly out of scope for Phase A: every row belongs to exactly one
production today.

## Cross-tenant integrity is enforced at the database level

Beyond the plain FK to `productions` every table gets, every child-to-parent
reference **within** this domain (a checkpoint's `resource_id`, a device's
`checkpoint_id`, ...) uses a **composite foreign key** against
`(id, production_id)` on the parent, backed by a `unique(id, production_id)`
constraint on that parent. This makes "a checkpoint from Production A
pointing at a resource from Production B" a database-level impossibility,
not merely an application-layer check — plain SQL (composite UNIQUE +
composite FOREIGN KEY), no triggers, consistent with how this codebase
already does DDL. This was directly verified during Phase A development:
inserting a cross-production `access_checkpoints` row is rejected by
Postgres with a foreign-key violation, not silently accepted.

## The identity model

`access_identities` is the one generic Person/Identity table every other
table in this domain references via `identity_id`. It reuses the exact
polymorphic-pair pattern already established repeatedly in this codebase
(`dietary_profiles`, `meal_service_assignments`): a `person_category`
enum (`CAST` | `CREW` | `EXTERNAL`) plus nullable `cast_member_id`/
`crew_member_id`, with a check constraint pinning exactly one non-null for
CAST/CREW, and `display_name` populated directly for EXTERNAL (a
visitor/vendor/contractor with no existing FilmSet person record).

`security_class` is a **separate axis** from `person_category` — a
crew-member-sourced identity can still be tagged `VENDOR` or `VIP`. The two
axes (where the identity's underlying record lives, vs. how the security
domain classifies them) are intentionally decoupled, per the owner's
explicit "a person can simultaneously be crew, vendor, ..." requirement.

## The resource hierarchy

`access_resources` is a generic, arbitrary-depth self-referencing tree
(`parent_resource_id`), not a hard-coded set of levels. `location_id`
optionally roots a resource tree at an existing FilmSet `Location` without
duplicating it. Phase A does not implement hierarchy-aware policy
resolution (e.g. "a grant on the parent zone implies access to every child
room") — the policy engine (`ACCESS_POLICY_ACCESS_CONTROL.md`) evaluates
against whatever set of already-resolved grants its caller passes in;
walking the resource tree to resolve that set is deferred, documented
future-phase work, not silently dropped.

## Credential lifecycle

`access_credentials.status` is a real lifecycle
(`DRAFT → PENDING_APPROVAL → ACTIVE → SUSPENDED/LOST/REVOKED/EXPIRED/REPLACED`),
never a boolean. No PII lives on this table — see
`QR_SECURITY_ACCESS_CONTROL.md` for why `public_reference` is the only
thing ever meant to be encoded in a QR code.

## Reusable access templates

`access_profiles` / `access_profile_rules` / `access_identity_profiles` are
named, reusable rule sets assignable to many identities at once, so an
admin defines "Camera Department Standard Access" once rather than
repeating the same resource list per person. `access_grants` and
`access_restrictions` sit alongside profiles as, respectively, individual
overrides and explicit blocks — see `ACCESS_POLICY_ACCESS_CONTROL.md` for
how the policy engine resolves precedence between them.

## Append-only ledger

`access_events` is the verification ledger. Ordinary operators cannot alter
historical events: RLS is enabled with a SELECT policy only, and — same as
every other table added in this migration — **no INSERT/UPDATE/DELETE
policy exists yet**, because no Server Action writes to it yet (Phase A is
schema-only). When a later phase adds the real scan-writing Server Action,
that PR adds a narrowly-scoped INSERT policy then, matching the precedent
`0017_authorization_foundation.sql` and `0018_booking_approval_engine.sql`
already set for shipping schema ahead of the code that uses it.

## Known, documented gaps (not silently dropped)

- `crew_members` has no `photo_path` column today (only `cast_members` and
  `locations` do) — a real pre-existing gap this migration does not patch.
  An EXTERNAL identity's own `photo_path` is this domain's only new photo
  storage, and will reuse the existing production-photos Storage bucket
  pattern (migration 0011) in a later phase, not a new bucket.
- No `security_musters` table yet (owner's spec §64, Phase F work, after
  core access/presence is stable).
- No facial recognition, biometric, NFC/OSDP hardware, or edge-gateway
  tables — explicitly out of scope for this release (owner's spec §84).
  See `OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md` for the documented interface a
  future phase would use instead.
