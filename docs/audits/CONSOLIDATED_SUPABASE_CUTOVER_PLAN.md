# Consolidated Supabase Cutover Plan

**Living document — updated every time a new migration is added to the pending set.** This is the single source of truth for the eventual one-time live Supabase cutover the owner has decided to do as one controlled event rather than per-PR. Nothing in this document has been run against live Supabase. Everything in it has been run, repeatedly, against real local PostgreSQL 16.

## Pending migrations, in order

| # | File | PR | Adds | Status |
|---|---|---|---|---|
| 1 | `packages/db/migrations/0016_organization_governance.sql` | [#24](https://github.com/gskfilmmaker/FilmSet/pull/24) (draft, base `main`) | `organizations`, `organization_memberships`, `productions.organization_id` | Locally verified, not live |
| 2 | `packages/db/migrations/0017_authorization_foundation.sql` | [#25](https://github.com/gskfilmmaker/FilmSet/pull/25) (draft, base `claude/p1a-organization-governance` — stacked on #24) | `permissions`, `roles`, `role_permissions`, `production_members.role_id`/`.status`/`.effective_from`/`.effective_until`, `departments`, `department_memberships`, `department_head_assignments`, `department_permissions`, `department_budget_scopes` | Locally verified, not live |

No PR beyond #25 has added a migration yet. `claude/p1c-authorization-wiring-plan` (stacked on #25) is docs + application-layer safety code only — no schema change, nothing to add to this table.

## Combined atomic cutover script

One paste, one execution, one transaction — applies both pending migrations in sequence and checks invariants for both before ever committing. Built and tested exactly the same way as each migration's own individual atomic script (see `VRINDAVAN_MIGRATION_IMPACT.md`), concatenated in migration order with one combined pre-flight and one combined post-check.

**Tested against real, local PostgreSQL 16, both paths:**
- **Success**: applied against a simulated pre-existing Vrindavan production (with content rows) — committed cleanly, printed `ALL CUTOVER INVARIANTS PASSED (0016 + 0017)`. Confirmed afterward: 71 permissions, 27 roles, 25 departments, `production_members.role_id` backfilled, Vrindavan's `id`/`created_by`/`created_at` unchanged.
- **Failure**: applied against a simulated multi-owner scenario (the same stop condition from the P1a review direction) — the pre-flight check aborted before either migration's DDL ran, and every subsequent statement in the batch correctly failed as "transaction is aborted." Confirmed afterward: neither `organizations` nor `permissions` tables exist, both original productions completely untouched.

```sql
begin;

-- ============================================================================
-- PRE-FLIGHT — aborts before touching anything if either stop condition
-- from the P1a review direction isn't met.
-- ============================================================================
do $$
declare
  v_vrindavan_count int;
  v_owner_count int;
begin
  select count(*) into v_vrindavan_count from public.productions where name = 'Vrindavan Mein Param Aanand';
  if v_vrindavan_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: expected exactly 1 production named ''Vrindavan Mein Param Aanand'', found %. Not safe to proceed.', v_vrindavan_count;
  end if;

  select count(*) into v_owner_count from (select distinct created_by from public.productions) x;
  if v_owner_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: found % distinct production creators, expected exactly 1. Review docs/audits/VRINDAVAN_MIGRATION_IMPACT.md before proceeding.', v_owner_count;
  end if;
end $$;

-- ============================================================================
-- BEFORE baseline — captured into temp tables, dropped automatically at
-- commit or rollback.
-- ============================================================================
create temp table _cutover_before_production on commit drop as
select id, name, created_by, created_at
from public.productions
where name = 'Vrindavan Mein Param Aanand';

create temp table _cutover_before_members on commit drop as
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');

create temp table _cutover_before_counts on commit drop as
select
  (select count(*) from public.scenes where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as scenes,
  (select count(*) from public.characters where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as characters,
  (select count(*) from public.cast_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as cast_members,
  (select count(*) from public.crew_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as crew_members,
  (select count(*) from public.shoot_days where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as shoot_days,
  (select count(*) from public.script_pages where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as script_pages,
  (select count(*) from public.breakdown_elements where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as breakdown_elements,
  (select count(*) from public.call_sheets where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as call_sheets,
  (select count(*) from public.documents where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as documents;

create temp table _cutover_before_production_count on commit drop as
select count(*) as n from public.productions;

-- ============================================================================
-- <<< PASTE THE FULL, UNMODIFIED CONTENTS OF
--     packages/db/migrations/0016_organization_governance.sql HERE >>>
-- ============================================================================

-- ============================================================================
-- <<< PASTE THE FULL, UNMODIFIED CONTENTS OF
--     packages/db/migrations/0017_authorization_foundation.sql HERE >>>
-- ============================================================================

-- ============================================================================
-- POST-CHECK — combined invariants for both migrations. Any failure raises
-- an exception, rolling back the entire transaction (both migrations'
-- DDL/DML included) automatically.
-- ============================================================================
do $$
declare
  v_before_id text;
  v_after_id text;
  v_before_created_by uuid;
  v_after_created_by uuid;
  v_before_created_at timestamptz;
  v_after_created_at timestamptz;
  v_after_org_id text;
  v_vrindavan_count_after int;
  v_org_name text;
  v_missing_org_count int;
  v_before_members_count int;
  v_after_members_count int;
  v_members_diff_count int;
  v_counts_match boolean;
  v_permissions_count int;
  v_roles_count int;
  v_missing_roleid_count int;
  v_departments_count int;
  v_expected_departments_count int;
  v_productions_count int;
begin
  -- ===== 0016 invariants =====
  select id, created_by, created_at into v_before_id, v_before_created_by, v_before_created_at from _cutover_before_production;
  select id, created_by, created_at, organization_id into v_after_id, v_after_created_by, v_after_created_at, v_after_org_id
    from public.productions where name = 'Vrindavan Mein Param Aanand';

  if v_before_id is distinct from v_after_id then
    raise exception 'INVARIANT FAILED (0016): production id changed (% -> %)', v_before_id, v_after_id;
  end if;
  if v_before_created_by is distinct from v_after_created_by then
    raise exception 'INVARIANT FAILED (0016): created_by changed (% -> %)', v_before_created_by, v_after_created_by;
  end if;
  if v_before_created_at is distinct from v_after_created_at then
    raise exception 'INVARIANT FAILED (0016): created_at changed (% -> %)', v_before_created_at, v_after_created_at;
  end if;
  if v_after_org_id is null then
    raise exception 'INVARIANT FAILED (0016): organization_id is still null after migration';
  end if;

  select count(*) into v_vrindavan_count_after from public.productions where name = 'Vrindavan Mein Param Aanand';
  if v_vrindavan_count_after != 1 then
    raise exception 'INVARIANT FAILED (0016): expected exactly 1 Vrindavan row after migration, found %', v_vrindavan_count_after;
  end if;

  select o.name into v_org_name from public.organizations o where o.id = v_after_org_id;
  if v_org_name is distinct from 'GSK Productions Inc.' then
    raise exception 'INVARIANT FAILED (0016): organization name is ''%'', expected ''GSK Productions Inc.''', v_org_name;
  end if;

  select count(*) into v_missing_org_count from public.productions where organization_id is null;
  if v_missing_org_count != 0 then
    raise exception 'INVARIANT FAILED (0016): % production(s) still missing organization_id', v_missing_org_count;
  end if;

  select count(*) into v_before_members_count from _cutover_before_members;
  select count(*) into v_after_members_count from public.production_members
    where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');
  if v_before_members_count != v_after_members_count then
    raise exception 'INVARIANT FAILED (0016): production_members row count changed (% -> %)', v_before_members_count, v_after_members_count;
  end if;

  select count(*) into v_members_diff_count from (
    (select production_id, user_id, role from _cutover_before_members
     except
     select production_id, user_id, role from public.production_members
       where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    union all
    (select production_id, user_id, role from public.production_members
       where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')
     except
     select production_id, user_id, role from _cutover_before_members)
  ) x;
  if v_members_diff_count != 0 then
    raise exception 'INVARIANT FAILED (0016): production_members rows differ from baseline (% mismatched row(s))', v_members_diff_count;
  end if;

  select
    b.scenes = (select count(*) from public.scenes where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.characters = (select count(*) from public.characters where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.cast_members = (select count(*) from public.cast_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.crew_members = (select count(*) from public.crew_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.shoot_days = (select count(*) from public.shoot_days where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.script_pages = (select count(*) from public.script_pages where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.breakdown_elements = (select count(*) from public.breakdown_elements where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.call_sheets = (select count(*) from public.call_sheets where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    and b.documents = (select count(*) from public.documents where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
  into v_counts_match
  from _cutover_before_counts b;

  if not v_counts_match then
    raise exception 'INVARIANT FAILED (0016/0017): one or more content-table counts changed for Vrindavan Mein Param Aanand';
  end if;

  -- ===== 0017 invariants =====
  select count(*) into v_permissions_count from public.permissions;
  if v_permissions_count != 71 then
    raise exception 'INVARIANT FAILED (0017): expected 71 permissions, found %', v_permissions_count;
  end if;

  select count(*) into v_roles_count from public.roles;
  if v_roles_count != 27 then
    raise exception 'INVARIANT FAILED (0017): expected 27 roles, found %', v_roles_count;
  end if;

  select count(*) into v_missing_roleid_count
  from public.production_members
  where role in ('Producer', 'Director', '1st AD', 'UPM', 'Production Accountant', 'Department Head', 'Crew')
    and role_id is null;
  if v_missing_roleid_count != 0 then
    raise exception 'INVARIANT FAILED (0017): % production_members row(s) with a known role text have a null role_id', v_missing_roleid_count;
  end if;

  select n into v_productions_count from _cutover_before_production_count;
  v_expected_departments_count := v_productions_count * 25;
  select count(*) into v_departments_count from public.departments;
  if v_departments_count != v_expected_departments_count then
    raise exception 'INVARIANT FAILED (0017): expected % departments (% productions x 25), found %', v_expected_departments_count, v_productions_count, v_departments_count;
  end if;

  raise notice 'ALL CUTOVER INVARIANTS PASSED (0016 + 0017) for Vrindavan Mein Param Aanand — safe to commit.';
end $$;

commit;
```

**If this reaches `commit;` and prints the success notice, every invariant above held.** If any check fails, Postgres has already rolled back the entire transaction — both migrations' DDL/DML included — before the error reaches you; nothing is left half-applied. As with each individual migration's own atomic script, `rollback;` (in place of `commit;`) is always available if a manual review after the notice still looks wrong before you commit.

## Vrindavan invariant checks (summary — full detail above)

- Production `id`, `created_by`, `created_at` byte-identical before/after.
- Exactly one production named "Vrindavan Mein Param Aanand" — before and after (no duplicate).
- `production_members` rows for Vrindavan byte-identical before/after (both directions — additions and removals both caught).
- Every content-table count (scenes, characters, cast_members, crew_members, shoot_days, script_pages, breakdown_elements, call_sheets, documents) unchanged.
- `organization_id` populated, organization named exactly "GSK Productions Inc."
- Every `production_members` row with a recognized role text has a non-null `role_id`.
- Department count matches `productions_count × 25` exactly.
- Permission/role catalog counts match their expected seed sizes (71 / 27).

## Combined rollback

Reverse migration order (undo 0017 first, then 0016) — matches how the two migrations were applied. Verified against a populated test database: restores `production_members` and every existing table to their exact pre-0016 shape.

```sql
begin;

-- ===== Undo 0017 =====
drop policy if exists "production members read department budget scopes" on public.department_budget_scopes;
drop policy if exists "production members read department permission grants" on public.department_permissions;
drop policy if exists "production members read HOD assignments" on public.department_head_assignments;
drop policy if exists "read own or co-department membership rows" on public.department_memberships;
drop policy if exists "members read departments" on public.departments;
drop policy if exists "read role_permissions for a visible role" on public.role_permissions;
drop policy if exists "read system template roles or own org's custom roles" on public.roles;
drop policy if exists "any authenticated user reads the permission catalog" on public.permissions;

drop function if exists public.is_department_member(text);
drop function if exists public.is_department_head(text);

drop table if exists public.department_budget_scopes;
drop table if exists public.department_permissions;
drop table if exists public.department_head_assignments;
drop table if exists public.department_memberships;
drop table if exists public.departments;

drop index if exists public.production_members_role_idx;
alter table public.production_members drop column if exists effective_until;
alter table public.production_members drop column if exists effective_from;
alter table public.production_members drop column if exists status;
alter table public.production_members drop column if exists role_id;

drop table if exists public.role_permissions;
drop table if exists public.roles;
drop table if exists public.permissions;

-- ===== Undo 0016 =====
drop policy if exists "select org memberships as member" on public.organization_memberships;
drop policy if exists "insert own org membership or owner adds member" on public.organization_memberships;
drop policy if exists "update org memberships as owner" on public.organization_memberships;
drop policy if exists "delete org memberships as owner or self" on public.organization_memberships;

drop policy if exists "select organizations as member" on public.organizations;
drop policy if exists "insert own organization" on public.organizations;
drop policy if exists "update organizations as owner" on public.organizations;
drop policy if exists "delete organizations as owner" on public.organizations;

drop function if exists public.is_organization_member(text);
drop function if exists public.is_organization_owner(text);

drop index if exists public.productions_organization_idx;
drop index if exists public.organization_memberships_user_idx;
drop index if exists public.organizations_created_by_idx;

alter table public.productions drop column if exists organization_id;

drop table if exists public.organization_memberships;
drop table if exists public.organizations;

-- Verify productions/production_members look right, THEN:
commit;
-- (or `rollback;` if something here looks wrong too.)
```

## PR merge order (once the owner authorizes the live cutover)

1. **Run the combined atomic cutover script above against live Supabase.** Verify the success notice, review the invariant results, `commit;`.
2. **Merge PR #24** (P1a) into `main`.
3. **Retarget PR #25** (P1b) from base `claude/p1a-organization-governance` to base `main`, resolve if `main` has moved, re-verify locally, then merge into `main`.
4. **Retarget and merge PR #26** (P1c, once opened) from base `claude/p1b-authorization-departments` to `main`, same process.
5. Any further stacked PRs (P2/P3/P4, as they're opened), in the same retarget-and-merge sequence, in the order they were built.

## CI order

CI (`.github/workflows/ci.yml`) only runs automatically on PRs targeting `main` and on pushes to `main` — it does **not** run on these stacked PRs today, since each targets the previous stacked branch, not `main` (confirmed directly: PR #25 and PR #26 show zero CI check runs, only the Vercel preview check). This means:

- Every stacked PR must be **locally verified** (lint/typecheck/test/build, exactly as documented in each PR's own description) before merge — that verification already exists for every PR opened so far.
- CI only becomes real for a given PR the moment it's retargeted to `main` (step 3/4 above) — expect a fresh CI run at that point, and treat it as required before that specific merge, same as any other PR into `main`.
- The live Supabase cutover (step 1) happens **before** any retargeting — the app's code isn't merged to `main` (and thus isn't deployed) until the database it depends on already has the schema, avoiding exactly the "deployed code expects tables that don't exist yet" failure mode the owner flagged.

## Smoke-test checklist (after cutover + merges, before declaring done)

1. Login with an existing account — normal sign-in flow works.
2. Load the Vrindavan Mein Param Aanand dashboard/overview — data renders, nothing errors.
3. Logout, then log back in immediately — no redirect loop, no stale session issue.
4. Load a protected page requiring production membership (e.g. `/schedule`, `/cast`) — loads normally.
5. Owner/admin (Producer role) access — can still reach Settings, Team management, budget pages exactly as before.
6. A non-Producer member's access — unaffected (still governed entirely by the unchanged `production_members.role`/RLS, per P1a/P1b's explicit "nothing wired in" scope).
7. Create a brand-new test production (not Vrindavan) — confirms `production-actions.ts`'s organization find-or-create logic (P1a) works live, not just locally.
8. Confirm no console errors/500s on any of the above.

## What must be verified before deployment

- [ ] Combined atomic script committed successfully against live Supabase, invariants confirmed via its own output plus the owner's independent spot-check queries (`VRINDAVAN_MIGRATION_IMPACT.md`'s Owner Runbook queries, run against the real Vrindavan row).
- [ ] `select distinct created_by from public.productions;` reviewed **before** running the cutover — confirms the single-owner assumption still holds against real, current data (the pre-flight check also enforces this automatically, but a human review first is the belt to its suspenders).
- [ ] All stacked PRs' local verification (lint/typecheck/test/build) re-run one final time on each branch immediately before its retarget-and-merge step, not relied on from when it was originally opened.
- [ ] Smoke-test checklist above completed on the live deployed app after the final merge.
- [ ] No `assertRole()`/`authorize()` behavior has changed anywhere — P1a/P1b/P1c are additive-only; this is a structural property of the code (verifiable by re-reading the diffs), not something that needs separate live testing, but worth confirming nothing drifted between when each PR was written and when it's actually deployed.
