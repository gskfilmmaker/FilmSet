# ID Numbering Convention

Standard operating procedure for the human-readable IDs FilmSet itself issues: credential numbers, resource codes, checkpoint codes. Implemented in migration `0028_id_numbering_system.sql` ("P19") and `apps/web/lib/id-registry.ts`.

## Scope: what gets a generated number, and what doesn't

Two categories of "number" exist in this app, and only one of them belongs to this system:

1. **Identifiers FilmSet issues** — credential numbers, resource codes, checkpoint codes. These are ours to generate, because nothing outside the app has a prior claim on what they should be. This system covers exactly these three, today.
2. **Identifiers captured from someone else's paperwork** — vendor invoice numbers, hotel room numbers, booking confirmation references, vendor POs. These stay free text and must **never** be auto-generated: the number has to match a real external document, and inventing one would fight reality, not organize it. If a future feature needs a numbering system for something new, ask which category it falls into before wiring it up.

## Format

```
{PRODUCTION-SHORT-CODE}-{ENTITY}-{sequence}
```

Example: `VMPA-CR-000001` (a credential), `VMPA-RS-000014` (a resource), `VMPA-CP-000003` (a checkpoint).

- **Short code** — a producer-editable prefix (2-8 uppercase letters/numbers), set in Settings → Production branding. Defaults to the production name's initials (e.g. "Vrindavan Mein Param Aanand" → `VMPA`) whenever unset — see `deriveShortCode()` in `apps/web/lib/id-format.ts`.
- **Entity code** — `CR` (credential), `RS` (resource), `CP` (checkpoint). See `ENTITY_CODES` in the same file if a new entity type is ever added.
- **Sequence** — a 6-digit, zero-padded, monotonically increasing integer, scoped independently per `(production, entity_type)`.

## How a number is issued

- **Preview** (`peekNextEntityNumber`): read-only, shown as the form's placeholder the moment "Add" opens. Never consumes a number — an abandoned form (opened, then cancelled) costs nothing.
- **Issue** (`issueNextEntityNumber`): a single `insert ... on conflict do update ... returning` statement against `id_sequences`, executed inside the same transaction as the actual row insert. Postgres runs this atomically, so two Producers saving at the same instant can never be handed the same number — no explicit row locking needed.
- A Producer can always type a custom value instead of accepting the suggestion (e.g. to match a pre-printed physical badge stock). A custom value doesn't advance the counter; it's validated only by the ordinary database uniqueness constraint.

## Non-reuse and gaps

- **Numbers are never reused.** Once issued, a credential number/resource code/checkpoint code stays permanently associated with that record, even after the record is revoked or deleted. This matches real physical-security practice: a retired badge number staying retired is what makes an audit trail trustworthy.
- **Gaps are normal, not a bug.** A cancelled form, a revoked credential, a deleted resource — all of these can leave a gap in the sequence. Do not attempt to "fill in" gaps or renumber existing records to close them.

## Closed gap: delete is now a soft delete

As of migration 0029 (P20), `deleteCredential`, `deleteResource`, `deleteCheckpoint`, and every other `delete*`/`unassignProfile` function in `apps/web/app/security-access/actions.ts` no longer perform a real database delete — each sets `deleted_at`/`deleted_by` on the row instead, and every list query filters `deleted_at is null`. A row's number/code is therefore never actually removed, only hidden from the active lists; the row (and its number) remains in the database permanently, and `access_audit_log` records the delete itself (who, when, and the row's full state at the time). See `docs/security/AUDIT_TRAIL_ACCESS_CONTROL.md` for the full design.

## Extending this to a new entity type

1. Add the new key to `ENTITY_CODES` in `apps/web/lib/id-format.ts` (2-letter code).
2. Add `production_id, entity_type` rows will be created automatically on first use — no schema change needed per entity type, `id_sequences` is already generic.
3. If the target column doesn't already have a per-production uniqueness constraint, add one (see `access_resources_code_unique` / `access_checkpoints_code_unique` in migration 0028 for the pattern) — a numbering system without a uniqueness guarantee isn't one.
4. Wire `peekNextEntityNumber`/`issueNextEntityNumber` into the relevant Server Action, mirroring `createCredential`'s pattern in `apps/web/app/security-access/actions.ts`.
