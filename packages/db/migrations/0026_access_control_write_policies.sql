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
