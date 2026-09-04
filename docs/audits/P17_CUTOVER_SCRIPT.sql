-- ============================================================================
-- FilmSet -- P17 Cutover Script (0026)
-- Generated to accompany the Security & Access Phase B, Part 1 PR (write
-- RLS policies enabling the new Security Admin UI's Server Actions).
-- Applies migration 0026_access_control_write_policies.sql against live
-- Supabase.
--
-- This is purely additive: 32 new CREATE POLICY statements across 11
-- existing tables (shipped empty and read-only by P16/0025). No table is
-- created, altered, or dropped; no existing row anywhere is touched.
--
-- The pre-flight below confirms migration 0025 (Security & Access Phase A)
-- is already live and that this script hasn't already been run, before
-- touching anything.
--
-- If this reaches commit and prints the success notice, every invariant
-- held. If ANY check fails, Postgres has already rolled back the entire
-- transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_identities') then
    raise exception 'PRE-FLIGHT ABORT: public.access_identities not found -- migration 0025 (Security & Access Phase A) does not appear to be live yet. This script depends on 0000-0025 already being applied.';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'access_identities' and policyname = 'members write access_identities') then
    raise exception 'PRE-FLIGHT ABORT: policy "members write access_identities" already exists -- migration 0026 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: 0000-0025 are live, 0026 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0026_access_control_write_policies.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P17 -- Security & Access, Phase B: write RLS policies for the Security &
-- Access domain (0025_access_control_foundation.sql shipped every one of
-- these 15 tables read-only -- RLS enabled, exactly one SELECT policy,
-- zero write policies -- deliberately, since no Server Action wrote to
-- any of them yet).
--
-- This migration opens INSERT/UPDATE/DELETE for the 11 tables Phase B's
-- Server Actions actually mediate: access_identities, access_credentials,
-- access_resources, access_profiles, access_profile_rules,
-- access_identity_profiles, access_grants, access_restrictions,
-- access_checkpoints, access_devices, access_temporary_grants.
--
-- Deliberately UNCHANGED (still read-only, no write policy added here):
-- - access_device_enrollments -- needs the secure hashed-token enrollment
--   flow (owner's spec 14), not yet built.
-- - access_events -- the append-only verification ledger; only a future
--   scan-verification endpoint should ever insert into it, never general
--   admin CRUD.
-- - access_visitor_details -- needs the visitor check-in flow, not yet
--   built.
-- - access_incidents -- needs the incident-reporting flow, not yet built.
-- Each stays exactly as 0025 left it until the phase that actually wires
-- writes to it adds its own narrow policy then -- same precedent this
-- migration train has followed since 0017/0018/0019.
--
-- GATING: every policy below is membership-scoped only
-- (public.is_production_member(production_id)), matching the exact,
-- real, established precedent for every other production-scoped content
-- table in this schema (0001's characters/cast_members/crew_members/etc,
-- 0019's own department_memberships fix) -- RLS enforces tenant
-- isolation, and the stricter "Producer only" authorization check is left
-- to the app layer via requireProductionMember(productionId, ["Producer"])
-- in each Server Action, exactly as 0019's own header comment documents
-- for this same reasoning. This migration intentionally does NOT invent a
-- new DB-level permission-check mechanism (e.g. a has_permission() SQL
-- function evaluating role_permissions) -- no other domain in this schema
-- gates RLS that way, and doing it only for this domain would be new,
-- inconsistent precedent.
-- ============================================================================

-- access_identities
create policy "members write access_identities" on public.access_identities for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_identities" on public.access_identities for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_identities" on public.access_identities for delete
  to authenticated using (public.is_production_member(production_id));

-- access_credentials
create policy "members write access_credentials" on public.access_credentials for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_credentials" on public.access_credentials for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_credentials" on public.access_credentials for delete
  to authenticated using (public.is_production_member(production_id));

-- access_resources
create policy "members write access_resources" on public.access_resources for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_resources" on public.access_resources for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_resources" on public.access_resources for delete
  to authenticated using (public.is_production_member(production_id));

-- access_profiles
create policy "members write access_profiles" on public.access_profiles for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_profiles" on public.access_profiles for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_profiles" on public.access_profiles for delete
  to authenticated using (public.is_production_member(production_id));

-- access_profile_rules
create policy "members write access_profile_rules" on public.access_profile_rules for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_profile_rules" on public.access_profile_rules for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_profile_rules" on public.access_profile_rules for delete
  to authenticated using (public.is_production_member(production_id));

-- access_identity_profiles
create policy "members write access_identity_profiles" on public.access_identity_profiles for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members delete access_identity_profiles" on public.access_identity_profiles for delete
  to authenticated using (public.is_production_member(production_id));
-- No update policy: an identity-profile assignment is assign/unassign only, never edited in place
-- (assignedBy/assignedAt are set once at insert) -- matches how access_identity_profiles has no
-- mutable columns beyond its own existence.

-- access_grants
create policy "members write access_grants" on public.access_grants for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_grants" on public.access_grants for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_grants" on public.access_grants for delete
  to authenticated using (public.is_production_member(production_id));

-- access_restrictions
create policy "members write access_restrictions" on public.access_restrictions for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_restrictions" on public.access_restrictions for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_restrictions" on public.access_restrictions for delete
  to authenticated using (public.is_production_member(production_id));

-- access_checkpoints
create policy "members write access_checkpoints" on public.access_checkpoints for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_checkpoints" on public.access_checkpoints for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_checkpoints" on public.access_checkpoints for delete
  to authenticated using (public.is_production_member(production_id));

-- access_devices
create policy "members write access_devices" on public.access_devices for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_devices" on public.access_devices for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_devices" on public.access_devices for delete
  to authenticated using (public.is_production_member(production_id));

-- access_temporary_grants
create policy "members write access_temporary_grants" on public.access_temporary_grants for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update access_temporary_grants" on public.access_temporary_grants for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
create policy "members delete access_temporary_grants" on public.access_temporary_grants for delete
  to authenticated using (public.is_production_member(production_id));

-- ============================================================================
-- END packages/db/migrations/0026_access_control_write_policies.sql
-- ============================================================================

do $postcheck$
declare
  v_full_write_tables int;
  v_identity_profiles_policies int;
  v_still_readonly_tables int;
begin
  select count(*) into v_full_write_tables
  from (
    select tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'access_identities', 'access_credentials', 'access_resources', 'access_profiles',
        'access_profile_rules', 'access_grants', 'access_restrictions', 'access_checkpoints',
        'access_devices', 'access_temporary_grants'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
    group by tablename
    having count(distinct cmd) = 3
  ) sub;
  if v_full_write_tables <> 10 then
    raise exception 'INVARIANT FAILED: expected 10 tables with a full INSERT+UPDATE+DELETE policy set, found %', v_full_write_tables;
  end if;

  select count(*) into v_identity_profiles_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'access_identity_profiles' and cmd in ('INSERT', 'DELETE');
  if v_identity_profiles_policies <> 2 then
    raise exception 'INVARIANT FAILED: expected access_identity_profiles to have exactly an INSERT and a DELETE policy (no UPDATE), found %', v_identity_profiles_policies;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'access_identity_profiles' and cmd = 'UPDATE') then
    raise exception 'INVARIANT FAILED: access_identity_profiles should NOT have an UPDATE policy -- assignments are assign/unassign only.';
  end if;

  select count(distinct tablename) into v_still_readonly_tables
  from pg_policies
  where schemaname = 'public'
    and tablename in ('access_device_enrollments', 'access_events', 'access_visitor_details', 'access_incidents')
    and cmd <> 'SELECT';
  if v_still_readonly_tables <> 0 then
    raise exception 'INVARIANT FAILED: access_device_enrollments/access_events/access_visitor_details/access_incidents must remain write-policy-free in this phase, found % with one', v_still_readonly_tables;
  end if;

  raise notice 'ALL P17 CUTOVER INVARIANTS PASSED (0026) -- safe to commit.';
end $postcheck$;

commit;
