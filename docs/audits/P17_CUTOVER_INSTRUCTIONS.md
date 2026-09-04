# Instructions — FilmSet P17 Live Supabase Cutover (0026)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is

Security & Access, Phase B, Part 1 — opens write access (INSERT/UPDATE/DELETE) on 11 of the 15 tables P16 (migration 0025) created empty and read-only. This is what makes the new **Security & Access** admin screens (Identities, Credentials, Resources, Checkpoints, Devices tabs) actually able to save changes; until this runs, that screen will load and display correctly, but every add/edit/delete action will fail with a permissions error.

**This is purely additive: 32 new `CREATE POLICY` statements, zero table changes.** No table is created, altered, or dropped. No existing row anywhere — in this domain or any other — is read, changed, or deleted by this script.

## What this adds

Write policies (membership-scoped, matching how every other production-scoped table in this schema already works) for: `access_identities`, `access_credentials`, `access_resources`, `access_profiles`, `access_profile_rules`, `access_identity_profiles` (insert/delete only — assignments aren't edited in place), `access_grants`, `access_restrictions`, `access_checkpoints`, `access_devices`, `access_temporary_grants`.

**Deliberately left read-only, unchanged by this script:** `access_device_enrollments`, `access_events`, `access_visitor_details`, `access_incidents` — each needs a flow (secure device enrollment, the scan-verification endpoint, visitor check-in, incident reporting) that hasn't been built yet. A later phase adds each one's own narrow write policy when it actually ships the Server Action that needs it.

The RLS policies below only enforce tenant isolation (same production). The actual "only a Producer can write" authorization check lives in the application layer, inside each Server Action (`apps/web/app/security-access/actions.ts`) — this matches how every other sensitive write path in this codebase is already gated, and is documented in this migration's own header comment.

## Before you run anything

1. **Confirm you are connected to the correct Supabase project.**
2. **Run this during low traffic** if convenient — though the risk is low (policy-only changes, no table changes).
3. **Do not modify the SQL script below.**

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (between "SCRIPT BEGINS HERE" and "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution — it's wrapped in `begin; ... commit;`.
4. Watch the output.

## What success looks like

Near the end of the output, a `NOTICE` line reading exactly:

```
ALL P17 CUTOVER INVARIANTS PASSED (0026) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded. **You do not need to do anything else.**

## What failure looks like, and what to do

If migration 0025 (Security & Access Phase A) isn't live yet, or this script has already been run, it raises `PRE-FLIGHT ABORT:` naming exactly what didn't match, and Postgres automatically rolls back the entire transaction — nothing is left half-applied.

**Tested against real PostgreSQL 16**, in this order:

1. A full successful run against a scratch database with 0000–0025 already applied — reached the exact success `NOTICE` and committed. Verified afterward via `pg_policies`: all 10 fully-writable tables have exactly an INSERT+UPDATE+DELETE policy set, `access_identity_profiles` has exactly INSERT+DELETE (no UPDATE), and the 4 tables that should stay read-only in this phase (`access_device_enrollments`, `access_events`, `access_visitor_details`, `access_incidents`) have zero write policies.
2. A re-run of the exact same script against that now-migrated database — correctly aborts with `PRE-FLIGHT ABORT: policy "members write access_identities" already exists...` and rolls back.
3. A run against a fresh database with only migrations up through 0000-init applied (no 0025) — correctly aborts with `PRE-FLIGHT ABORT: public.access_identities not found...` and rolls back.
4. A post-cutover functional test: as an actual production member (via the real `authenticated` Postgres role and a JWT claim, not the table-owner role), inserting an identity, a credential, a resource, a checkpoint, and a device all succeed. The identical insert attempted by a user who is **not** a member of that production is correctly rejected — `ERROR: new row violates row-level security policy for table "access_identities"`.

If you get any exception:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code (the Security & Access admin UI and its Server Actions) is not deployed yet; merging that PR is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
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

```

# SCRIPT ENDS HERE
