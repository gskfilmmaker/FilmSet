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
