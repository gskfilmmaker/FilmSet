# Instructions — FilmSet P20 Live Supabase Cutover (0029)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is

Four related changes to the Security & Access domain, all closing the same real gap — nothing in this module currently keeps a trace of who changed what, and a delete is permanent with no way back:

1. **Security class split** — the combined `DIRECTOR_PRODUCER` tier is replaced with separate `DIRECTOR` and `PRODUCER` classes. Any existing identity or credential using the combined value is migrated to `PRODUCER` **before** the CHECK constraint is tightened to drop the old value, so no row is ever left violating a constraint mid-migration.
2. **Soft delete** — `deleted_at`/`deleted_by` columns added to all 11 tables the Security & Access admin UI can delete a row from. A "delete" in the app becomes an `UPDATE ... SET deleted_at = now()`, never a real `DELETE`; every list query filters `deleted_at is null`. This also means a credential number, resource code, or checkpoint code is never freed up for reuse just because the record was "deleted" — reinforcing the non-reuse guarantee `docs/security/ID_NUMBERING_CONVENTION.md` already promises.
3. **Audit log** — a new, generic, append-only `access_audit_log` table: one row per create/update/(soft)delete across every table in this domain, with a full before/after snapshot and who did it. RLS grants only SELECT and INSERT — **never** UPDATE or DELETE — so the log itself cannot be edited or purged through the app.
4. **`access_events` gains an INSERT policy** — still no UPDATE/DELETE. Migrations 0025/0026 deliberately left this table read-only, reserving writes for a future scan-verification endpoint; that endpoint is what this phase's application code adds.

Until this runs, the app's split `DIRECTOR`/`PRODUCER` security classes, soft-delete-backed admin actions, audit-log writes, and the new `/security-access` Scan tab will all fail (the app code that needs these is a matched PR, not deployed until this runs first).

## What this changes

- **Data migration**: any `access_identities.security_class = 'DIRECTOR_PRODUCER'` or `access_credentials.credential_class = 'DIRECTOR_PRODUCER'` row is updated to `'PRODUCER'`. This is the one step that touches existing data; everything else is additive.
- **Constraint replacement**: `access_identities_security_class_valid` and `access_credentials_class_valid` are dropped and recreated with `DIRECTOR` and `PRODUCER` as separate allowed values (in place of the single `DIRECTOR_PRODUCER` value).
- **11 new column pairs**: `deleted_at timestamptz` / `deleted_by uuid references profiles(id) on delete set null`, nullable, added to `access_identities`, `access_credentials`, `access_resources`, `access_checkpoints`, `access_devices`, `access_profiles`, `access_profile_rules`, `access_identity_profiles`, `access_grants`, `access_restrictions`, `access_temporary_grants`. Existing rows are unaffected (`NULL` = not deleted).
- **1 new table**: `access_audit_log` (RLS-enabled, SELECT+INSERT policies only).
- **1 new policy**: `access_events` gets an INSERT policy (still SELECT-only otherwise, no UPDATE/DELETE ever).

## Before you run anything

1. **Confirm you are connected to the correct Supabase project.**
2. **Run this during low traffic** if convenient — the data migration touches existing rows (any `DIRECTOR_PRODUCER` value), though the blast radius is small (typically zero or a handful of rows).
3. **Do not modify the SQL script below.**

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (between "SCRIPT BEGINS HERE" and "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution — it's wrapped in `begin; ... commit;`.
4. Watch the output.

## What success looks like

Near the end of the output, a `NOTICE` line reading exactly:

```
ALL P20 CUTOVER INVARIANTS PASSED (0029) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded. **You do not need to do anything else.**

## What failure looks like, and what to do

If the base schema isn't live yet, or this script has already been run, it raises `PRE-FLIGHT ABORT:` naming exactly what didn't match, and Postgres automatically rolls back the entire transaction — nothing is left half-applied.

If a postcheck `INVARIANT FAILED:` fires instead, that means the script ran but something about the resulting state doesn't match what it should — copy the exact message and report it back rather than re-running.

**Tested against real PostgreSQL 16**, in this order:

1. A full successful run against a scratch database with every prior migration (0000–0028) already applied, seeded with one identity and one credential both holding the retired `security_class = 'DIRECTOR_PRODUCER'` / `credential_class = 'DIRECTOR_PRODUCER'` value — reached the exact success `NOTICE` and committed. Verified afterward: both seeded rows now read `PRODUCER`; `access_audit_log` exists with exactly SELECT+INSERT policies (no UPDATE/DELETE); `access_events` now has exactly SELECT+INSERT policies (no UPDATE/DELETE); all 11 tables have both `deleted_at` and `deleted_by` columns.
   - **Caught and fixed during this test**: the first draft of this script dropped-then-recreated the CHECK constraints *after* the data migration UPDATE, which meant the `UPDATE ... SET security_class = 'PRODUCER'` statement itself was checked against the *old* constraint (whose allowed list has no bare `'PRODUCER'` value) and failed. Fixed by reordering: drop both old constraints first, then run the data migration, then add the new constraints. Re-tested clean after the fix.
2. A re-run of the exact same script against that now-migrated database — correctly aborts with `PRE-FLIGHT ABORT: public.access_audit_log already exists...` and rolls back.
3. A run against a fresh, empty database (no prior migrations applied) — correctly aborts with `PRE-FLIGHT ABORT: public.productions not found...` and rolls back.
4. A functional test of the new split classes: inserting an identity with `security_class = 'DIRECTOR'` and another with `'PRODUCER'` both succeeded; inserting one with the retired `'DIRECTOR_PRODUCER'` value correctly failed with `violates check constraint "access_identities_security_class_valid"`.
5. A functional test of soft delete: `UPDATE ... SET deleted_at = now(), deleted_by = <uuid>` on an existing row succeeded and is visible as deleted.
6. A functional test of the audit log: inserting a row into `access_audit_log` succeeded; inserting one with an invalid `action` value (`'PURGE'`) correctly failed with `violates check constraint "access_audit_log_action_valid"`; `pg_policies` confirms exactly SELECT+INSERT policies on both `access_audit_log` and `access_events`, with no UPDATE/DELETE policy on either.

If you get any exception not covered above:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code (split security-class labels, soft-delete-backed admin actions, audit-log writes, the scan-verification `/security-access` Scan tab) is not deployed yet; merging that PR is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
-- ============================================================================
-- FilmSet -- P20 Cutover Script (0029)
-- Generated to accompany the audit-trail / soft-delete / security-class-split
-- / scan-verification PR (Security & Access).
-- Applies migration 0029_audit_trail_soft_delete_class_split.sql against live Supabase.
--
-- Four related changes, in order:
--   1. DIRECTOR_PRODUCER -> DIRECTOR + PRODUCER (data migration BEFORE the
--      CHECK constraint is tightened, so no existing row is ever left
--      violating the new constraint).
--   2. deleted_at/deleted_by added to all 11 tables Phase B's admin UI can
--      delete a row from (nullable, existing rows unaffected).
--   3. access_audit_log created -- new, empty, RLS-enabled (SELECT+INSERT
--      only, no UPDATE/DELETE).
--   4. access_events gains an INSERT policy (still no UPDATE/DELETE) --
--      0025/0026 deliberately left this table read-only pending this exact
--      scan-verification endpoint.
--
-- The pre-flight below confirms this script hasn't already been run before
-- touching anything.
--
-- If this reaches commit and prints the success notice, every invariant
-- held. If ANY check fails, Postgres has already rolled back the entire
-- transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'productions') then
    raise exception 'PRE-FLIGHT ABORT: public.productions not found -- this script depends on the base schema already being applied.';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_events') then
    raise exception 'PRE-FLIGHT ABORT: public.access_events not found -- this script depends on migration 0025 (Security & Access Phase A) already being applied.';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_profile_rules') then
    raise exception 'PRE-FLIGHT ABORT: public.access_profile_rules not found -- this script depends on migration 0025 (Security & Access Phase A) already being applied.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_audit_log') then
    raise exception 'PRE-FLIGHT ABORT: public.access_audit_log already exists -- migration 0029 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: base schema is live, 0029 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0029_audit_trail_soft_delete_class_split.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P20 -- Three related changes to the Security & Access domain, all
-- addressing the same real gap: nothing in this module currently keeps a
-- trace of who changed what, and a delete is permanent with no way back.
--
-- 1. Security class split -- DIRECTOR_PRODUCER was one combined tier;
--    replaced with separate DIRECTOR and PRODUCER classes. One live
--    credential already used the combined value, so this migrates that
--    row (and any identity rows) to PRODUCER *before* tightening the CHECK
--    constraint -- never silently leaving a row that would now violate it.
--
-- 2. Soft delete -- every table Phase B's admin UI can delete from gets
--    deleted_at/deleted_by instead of ever really losing a row. This also
--    means a credential/resource/checkpoint's number or code is never
--    freed up for reuse just because the record was "deleted" -- exactly
--    the non-reuse guarantee docs/security/ID_NUMBERING_CONVENTION.md
--    already promises, now actually enforced at the data layer instead of
--    merely documented as a gap.
--
-- 3. Audit log -- access_audit_log is a new, generic, append-only table:
--    one row per create/update/(soft)delete across every table in this
--    domain, with a full before/after snapshot and who did it. RLS grants
--    only SELECT and INSERT -- never UPDATE or DELETE -- so the log itself
--    cannot be edited or purged through the app, matching how a real audit
--    trail has to behave (ISO/IEC 27001 A.8.15 / NIST 800-53 AU-2's
--    intent: security-relevant events are recorded and tamper-resistant).
--    The Producer-only *write* gate (who may act at all) stays exactly
--    where every other table in this migration train already puts it --
--    the app layer -- the audit log doesn't invent a new mechanism.
--
-- 4. access_events gains an INSERT policy -- still no UPDATE/DELETE.
--    0025/0026 deliberately left this table read-only, reserving writes
--    for "a future scan-verification endpoint" (0026's own header
--    comment). That endpoint is what this phase actually builds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Security class split. Constraints are dropped BEFORE the data migration,
--    not after -- the old constraint's allowed list has no bare 'PRODUCER'
--    value, so an UPDATE to 'PRODUCER' while it's still active would itself
--    violate it.
-- ----------------------------------------------------------------------------
alter table public.access_identities drop constraint access_identities_security_class_valid;
alter table public.access_credentials drop constraint access_credentials_class_valid;

update public.access_identities set security_class = 'PRODUCER' where security_class = 'DIRECTOR_PRODUCER';
update public.access_credentials set credential_class = 'PRODUCER' where credential_class = 'DIRECTOR_PRODUCER';

alter table public.access_identities add constraint access_identities_security_class_valid check (security_class in (
  'CREW', 'CAST', 'HOD', 'DIRECTOR', 'PRODUCER', 'BACKGROUND', 'DAY_PLAYER', 'VENDOR', 'CONTRACTOR',
  'VISITOR', 'MEDIA', 'SECURITY', 'DRIVER', 'VIP', 'TEMPORARY', 'LOCATION_STAFF', 'CUSTOM'
));

alter table public.access_credentials add constraint access_credentials_class_valid check (credential_class in (
  'CREW', 'CAST', 'HOD', 'DIRECTOR', 'PRODUCER', 'BACKGROUND', 'DAY_PLAYER', 'VENDOR', 'CONTRACTOR',
  'VISITOR', 'MEDIA', 'SECURITY', 'DRIVER', 'VIP', 'TEMPORARY', 'LOCATION_STAFF', 'CUSTOM'
));

-- ----------------------------------------------------------------------------
-- 2. Soft delete -- deleted_at/deleted_by on every table Phase B's admin UI
--    can delete a row from. Nullable; existing rows are unaffected (NULL =
--    not deleted). Every list query filters `where deleted_at is null`.
-- ----------------------------------------------------------------------------
alter table public.access_identities add column if not exists deleted_at timestamptz;
alter table public.access_identities add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_credentials add column if not exists deleted_at timestamptz;
alter table public.access_credentials add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_resources add column if not exists deleted_at timestamptz;
alter table public.access_resources add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_checkpoints add column if not exists deleted_at timestamptz;
alter table public.access_checkpoints add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_devices add column if not exists deleted_at timestamptz;
alter table public.access_devices add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_profiles add column if not exists deleted_at timestamptz;
alter table public.access_profiles add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_profile_rules add column if not exists deleted_at timestamptz;
alter table public.access_profile_rules add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_identity_profiles add column if not exists deleted_at timestamptz;
alter table public.access_identity_profiles add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_grants add column if not exists deleted_at timestamptz;
alter table public.access_grants add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_restrictions add column if not exists deleted_at timestamptz;
alter table public.access_restrictions add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.access_temporary_grants add column if not exists deleted_at timestamptz;
alter table public.access_temporary_grants add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. access_audit_log -- generic, append-only. table_name/record_id identify
--    the affected row (no FK -- the row it describes may itself have been
--    soft-deleted, and a delete of the parent production cascades this log
--    away too, which is correct: an audit trail for a production that no
--    longer exists has nothing left to audit).
-- ----------------------------------------------------------------------------
create table public.access_audit_log (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  action text not null,
  actor uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  before jsonb,
  after jsonb,
  constraint access_audit_log_action_valid check (action in ('INSERT', 'UPDATE', 'DELETE', 'RESTORE'))
);
create index access_audit_log_production_idx on public.access_audit_log (production_id);
create index access_audit_log_record_idx on public.access_audit_log (table_name, record_id);
create index access_audit_log_occurred_at_idx on public.access_audit_log (occurred_at);

alter table public.access_audit_log enable row level security;
create policy "members read access_audit_log" on public.access_audit_log for select
  to authenticated using (public.is_production_member(production_id));
create policy "members write access_audit_log" on public.access_audit_log for insert
  to authenticated with check (public.is_production_member(production_id));
-- No update or delete policy: an audit log that could be edited or erased
-- through the app isn't one.

-- ----------------------------------------------------------------------------
-- 4. access_events -- open INSERT only (still no UPDATE/DELETE), for the
--    scan-verification endpoint this phase builds.
-- ----------------------------------------------------------------------------
create policy "members write access_events" on public.access_events for insert
  to authenticated with check (public.is_production_member(production_id));

-- ============================================================================
-- END packages/db/migrations/0029_audit_trail_soft_delete_class_split.sql
-- ============================================================================

do $postcheck$
declare
  v_identity_class_def text;
  v_credential_class_def text;
  v_stray_identity_rows int;
  v_stray_credential_rows int;
  v_soft_delete_missing text;
  v_audit_log_policies int;
  v_events_policies int;
begin
  select pg_get_constraintdef(oid) into v_identity_class_def
  from pg_constraint where conname = 'access_identities_security_class_valid';
  if v_identity_class_def is null or v_identity_class_def like '%DIRECTOR_PRODUCER%' or v_identity_class_def not like '%DIRECTOR%' or v_identity_class_def not like '%PRODUCER%' then
    raise exception 'INVARIANT FAILED: access_identities_security_class_valid does not look like the split DIRECTOR/PRODUCER constraint: %', v_identity_class_def;
  end if;

  select pg_get_constraintdef(oid) into v_credential_class_def
  from pg_constraint where conname = 'access_credentials_class_valid';
  if v_credential_class_def is null or v_credential_class_def like '%DIRECTOR_PRODUCER%' or v_credential_class_def not like '%DIRECTOR%' or v_credential_class_def not like '%PRODUCER%' then
    raise exception 'INVARIANT FAILED: access_credentials_class_valid does not look like the split DIRECTOR/PRODUCER constraint: %', v_credential_class_def;
  end if;

  select count(*) into v_stray_identity_rows from public.access_identities where security_class = 'DIRECTOR_PRODUCER';
  if v_stray_identity_rows <> 0 then
    raise exception 'INVARIANT FAILED: % access_identities rows still hold the retired DIRECTOR_PRODUCER value.', v_stray_identity_rows;
  end if;

  select count(*) into v_stray_credential_rows from public.access_credentials where credential_class = 'DIRECTOR_PRODUCER';
  if v_stray_credential_rows <> 0 then
    raise exception 'INVARIANT FAILED: % access_credentials rows still hold the retired DIRECTOR_PRODUCER value.', v_stray_credential_rows;
  end if;

  select string_agg(t, ', ') into v_soft_delete_missing
  from (values
    ('access_identities'), ('access_credentials'), ('access_resources'), ('access_checkpoints'),
    ('access_devices'), ('access_profiles'), ('access_profile_rules'), ('access_identity_profiles'),
    ('access_grants'), ('access_restrictions'), ('access_temporary_grants')
  ) as expected(t)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = expected.t and column_name = 'deleted_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = expected.t and column_name = 'deleted_by'
  );
  if v_soft_delete_missing is not null then
    raise exception 'INVARIANT FAILED: missing deleted_at/deleted_by on: %', v_soft_delete_missing;
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_audit_log') then
    raise exception 'INVARIANT FAILED: expected table access_audit_log to exist.';
  end if;

  select count(*) into v_audit_log_policies
  from pg_policies where schemaname = 'public' and tablename = 'access_audit_log' and cmd in ('SELECT', 'INSERT');
  if v_audit_log_policies <> 2 then
    raise exception 'INVARIANT FAILED: expected access_audit_log to have exactly SELECT+INSERT policies (no UPDATE/DELETE), found %', v_audit_log_policies;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'access_audit_log' and cmd in ('UPDATE', 'DELETE')) then
    raise exception 'INVARIANT FAILED: access_audit_log should NOT have an UPDATE or DELETE policy -- the log must not be editable or purgeable through the app.';
  end if;

  select count(*) into v_events_policies
  from pg_policies where schemaname = 'public' and tablename = 'access_events' and cmd in ('SELECT', 'INSERT');
  if v_events_policies <> 2 then
    raise exception 'INVARIANT FAILED: expected access_events to have exactly SELECT+INSERT policies after this migration, found %', v_events_policies;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'access_events' and cmd in ('UPDATE', 'DELETE')) then
    raise exception 'INVARIANT FAILED: access_events should NOT have an UPDATE or DELETE policy -- the verification ledger must stay append-only.';
  end if;

  raise notice 'ALL P20 CUTOVER INVARIANTS PASSED (0029) -- safe to commit.';
end $postcheck$;

commit;

```

# SCRIPT ENDS HERE
