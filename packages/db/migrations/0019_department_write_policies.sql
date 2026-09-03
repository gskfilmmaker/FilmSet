-- ============================================================================
-- Bug fix, found while building the Accommodation domain (next migration):
-- PR #31 (P6) shipped real, wired Server Actions
-- (apps/web/app/settings/departments/actions.ts — setDepartmentHead,
-- addDepartmentMember, removeDepartmentMember, changeDepartmentMemberRole)
-- that insert/update/delete department_memberships and
-- department_head_assignments via runAsUser, which really does
-- `set local role authenticated` before every query — the same RLS path
-- every real Server Action in this app goes through.
--
-- But 0017_authorization_foundation.sql only ever added SELECT policies
-- for those two tables, matching that migration's own "schema only,
-- unwired" scope at the time it was written. P6 wired real writes on top
-- without adding the write policies those writes need.
--
-- Confirmed with a real local PostgreSQL 16 check, run as the actual
-- `authenticated` role (not the table-owner role P6's own local
-- verification used, which bypasses RLS entirely and so never caught
-- this): inserting into department_memberships as `authenticated` fails
-- with "new row violates row-level security policy for table
-- department_memberships". Every one of the four actions above fails the
-- same way today in production, the moment any user actually uses the
-- Membership screen (Settings → Departments → a department →
-- Change HOD / add or remove a member / change a role).
--
-- Fix: add INSERT/UPDATE/DELETE policies to both tables, scoped to
-- production membership via the same join shape
-- department_head_assignments' own SELECT policy already uses. This
-- matches the established pattern for every other production-scoped
-- content table (0001_rls_and_auth_trigger.sql's characters/
-- cast_members/crew_members/etc: RLS enforces membership, the stricter
-- Producer-only check is left to the app layer via
-- requireProductionMember(productionId, ["Producer"]), exactly as these
-- four actions already do). Existing SELECT policies are left completely
-- untouched — their read scope doesn't change, only writes go from
-- always-denied to membership-gated.
-- ============================================================================

create policy "production members write department_memberships" on public.department_memberships for insert
  to authenticated
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members update department_memberships" on public.department_memberships for update
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members delete department_memberships" on public.department_memberships for delete
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members write HOD assignments" on public.department_head_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_head_assignments.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members delete HOD assignments" on public.department_head_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_head_assignments.department_id
        and public.is_production_member(d.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed:
-- - department_permissions / department_budget_scopes stay read-only —
--   no Server Action writes to either yet, so no write policy is needed
--   for them (adding one now with nothing to exercise it would be
--   speculative, the same reasoning 0017 itself used).
-- - Every SELECT policy on every table, including the two fixed here — no
--   read access changes for anyone.
-- ============================================================================
