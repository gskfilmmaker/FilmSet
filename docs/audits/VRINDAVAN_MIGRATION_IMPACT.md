# Vrindavan Mein Param Aanand — P1a Migration Impact

**Required by the P1a authorization before any schema change affecting production data.** This document covers migration `packages/db/migrations/0016_organization_governance.sql`: what it changes, why it's safe for the live "Vrindavan Mein Param Aanand" production, how to verify that before and after applying it, and how to reverse it if needed.

## Scope of this change

P1a adds an **Organization** governance layer above productions — nothing else. Explicitly out of scope (per the P1a authorization): Department schema, a centralized `authorize()` engine, and any Logistics/Travel/Hotel/Transport/Catering/Booking implementation. Those are P1b and later.

What the migration does, in order:

1. Creates two new tables: `organizations` and `organization_memberships`.
2. Adds `productions.organization_id` — nullable at first, so every existing row can be backfilled before the constraint locks in.
3. Backfills: creates exactly one organization, **"GSK Productions Inc."**, owned by whichever user created the earliest-existing production row, and assigns every existing production (Vrindavan Mein Param Aanand included, whatever its production id turns out to be) to that one organization.
4. Locks `organization_id` to `NOT NULL` now that every row has a value.
5. Adds RLS (mirroring the existing `production_members` pattern exactly) so organization data is visible only to its members.

## Owner Runbook — exact order, copy-paste into Supabase SQL Editor

Four steps, in this order. Do not skip the BEFORE step — the AFTER step is only meaningful as a diff against it. Everything is wrapped in an explicit transaction so a bad result can be rolled back before anything is committed.

### Step 1 — BEFORE: baseline (run first, save every result)

```sql
-- 1a. Vrindavan's current identity — save this whole row.
select id, name, created_by, created_at
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- 1b. Exactly one row expected. If this is anything other than 1, STOP —
-- do not proceed to Step 2 — and report back before continuing.
select count(*) as vrindavan_count
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- 1c. production_members mapped to Vrindavan today — save this output.
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')
order by user_id;

-- 1d. Content-table counts — save every number here.
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

-- 1e. Sanity check the backfill's single-owner assumption. If this returns
-- MORE THAN ONE ROW, STOP and report back before continuing — it means
-- more than one distinct user has created a production today, and the
-- backfill (Step 2) would put every production into one org owned by
-- whichever of them created the earliest one, which may not be what you
-- want.
select distinct created_by from public.productions;
```

### Step 2 — APPLY: run the migration inside an explicit transaction

Open `packages/db/migrations/0016_organization_governance.sql` from this PR's branch, copy its **entire contents**, and paste it into the SQL Editor between the `begin;` and the line below it — do not run `commit;` yet.

```sql
begin;

-- <<< paste the full, unmodified contents of
--     packages/db/migrations/0016_organization_governance.sql here >>>
```

Run it. Expect no errors. **Stay in this same SQL Editor session/transaction** — do not close the tab or start a new query window — and go straight to Step 3. Postgres lets the current transaction see its own uncommitted changes, so you can verify before deciding to keep them.

### Step 3 — AFTER: verify, still inside the same open transaction

```sql
-- 3a. Vrindavan's identity — id/created_by/created_at must be IDENTICAL to
-- Step 1a. organization_id should now be populated (not null).
select id, name, created_by, created_at, organization_id
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- 3b. Still exactly one Vrindavan row — must equal Step 1b (no duplicate
-- was created).
select count(*) as vrindavan_count
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- 3c. Organization exists and is named exactly "GSK Productions Inc."
select o.id, o.name, o.created_by
from public.organizations o
join public.productions p on p.organization_id = o.id
where p.name = 'Vrindavan Mein Param Aanand';

-- 3d. Organization membership exists for the owner.
select om.organization_id, om.user_id, om.role
from public.organization_memberships om
join public.productions p on p.organization_id = om.organization_id
where p.name = 'Vrindavan Mein Param Aanand';

-- 3e. production_members must match Step 1c exactly — same rows, unchanged.
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')
order by user_id;

-- 3f. Content-table counts — every number must match Step 1d exactly.
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

-- 3g. No production anywhere is missing an organization — must be 0.
select count(*) as productions_missing_org from public.productions where organization_id is null;

-- 3h. RLS policies present and correctly defined (see the RLS note below
-- for what this can and can't prove).
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('organizations', 'organization_memberships', 'productions', 'production_members')
order by tablename, policyname;
-- Confirm the four productions policies and four production_members
-- policies are present with the same names/definitions they had before
-- (nothing here should look new or different — this migration doesn't
-- touch them). Four new policies each on organizations and
-- organization_memberships should also appear.
```

**On RLS (query 3h) — an honest limit of what SQL Editor verification can prove:** the Supabase SQL Editor connects as the `postgres` superuser, which bypasses Row Level Security entirely. No query run there — before, during, or after this migration — can literally demonstrate "a stranger is blocked from seeing Vrindavan's data," because the Editor's own connection is never subject to that block. What query 3h *can* prove is that the policies which enforce that isolation still exist, unchanged, with the same definitions as before. Combined with query 3e (`production_members` — the table those policies key off — is unchanged), that's the strongest confirmation available from SQL Editor alone. An actual behavioral proof (a real second account genuinely can't see Vrindavan) requires testing through the live app itself, not the SQL Editor.

### Step 4 — Decision: commit or roll back

Look at every result from Step 3 against its Step 1 baseline.

- **Everything matches, exactly as described above** → run:
  ```sql
  commit;
  ```
- **Anything looks wrong** — a changed id, a missing row, a count that moved, an unexpected duplicate → run:
  ```sql
  rollback;
  ```
  This discards everything from Step 2 as if it never ran; Vrindavan's data is completely unaffected since nothing was ever committed. Report back with what looked wrong before retrying anything.

### Emergency rollback — only if a bad result was already committed

Use this only if Step 4's `commit;` already ran and a problem surfaced afterward — not the normal path (that's `rollback;` in Step 4, before committing).

```sql
begin;

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

This has been verified end-to-end against a populated test database (see "Verification performed before this PR was opened" below) — applying it after the migration restores `productions` to its exact pre-migration column set, policies, and data.

### Recommended: single atomic script (safer than Steps 1–4 above)

Steps 1–4 above rely on the SQL Editor keeping one transaction open across several separate "Run" clicks — reasonable, but not something to bet a live production migration on without confirming the Editor actually preserves session state that way. **This script removes that assumption entirely.** It is one paste, one "Run" click, one Postgres statement batch: captures the BEFORE baseline into temp tables, applies the migration, checks every invariant, and — this is the load-bearing part — a failed check calls `raise exception`, which Postgres propagates up and automatically rolls back everything in the entire batch, with no separate `rollback;` command needed and no dependency on the Editor's session behavior between clicks. If it reaches the final `commit;`, every check already passed.

Two of the checks below **hard-abort automatically** — not just warn — matching the stop conditions from the review direction: exactly one Vrindavan row must exist before touching anything, and exactly one distinct production creator must exist (the backfill's single-org assumption). If the second one fires and you've reviewed the owner list and are fine proceeding anyway, that's the one case where you'd fall back to the manual Steps 1–4 runbook instead — this script is intentionally strict by default.

```sql
begin;

-- ============================================================================
-- BEFORE baseline, captured into temp tables (dropped automatically at
-- commit or rollback — nothing left behind either way).
-- ============================================================================
create temp table _p1a_before_production on commit drop as
select id, name, created_by, created_at
from public.productions
where name = 'Vrindavan Mein Param Aanand';

create temp table _p1a_before_members on commit drop as
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');

create temp table _p1a_before_counts on commit drop as
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

-- ============================================================================
-- Pre-flight — abort BEFORE touching anything if either stop condition from
-- the review direction isn't met.
-- ============================================================================
do $$
declare
  v_vrindavan_count int;
  v_owner_count int;
begin
  select count(*) into v_vrindavan_count from public.productions where name = 'Vrindavan Mein Param Aanand';
  if v_vrindavan_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: expected exactly 1 production named ''Vrindavan Mein Param Aanand'', found %. Not safe to proceed — resolve this before re-running.', v_vrindavan_count;
  end if;

  select count(*) into v_owner_count from (select distinct created_by from public.productions) x;
  if v_owner_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: found % distinct production creators, expected exactly 1. The migration backfills every production into ONE organization owned by the earliest creator — with more than one distinct owner, review docs/audits/VRINDAVAN_MIGRATION_IMPACT.md''s "Known limitations" #3 before proceeding. If this is expected and fine, use the manual Steps 1-4 runbook instead of this script.', v_owner_count;
  end if;
end $$;

-- ============================================================================
-- Migration 0016 — paste verbatim from
-- packages/db/migrations/0016_organization_governance.sql, unmodified.
-- ============================================================================
-- <<< PASTE THE FULL, UNMODIFIED CONTENTS OF
--     packages/db/migrations/0016_organization_governance.sql HERE >>>

-- ============================================================================
-- Post-migration invariant checks. ANY failure raises an exception, which
-- rolls back this entire transaction — the migration statements above
-- included — automatically.
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
begin
  -- 1. Vrindavan's identity is byte-identical to the baseline; organization_id is populated.
  select id, created_by, created_at into v_before_id, v_before_created_by, v_before_created_at from _p1a_before_production;
  select id, created_by, created_at, organization_id into v_after_id, v_after_created_by, v_after_created_at, v_after_org_id
    from public.productions where name = 'Vrindavan Mein Param Aanand';

  if v_before_id is distinct from v_after_id then
    raise exception 'INVARIANT FAILED: production id changed (% -> %)', v_before_id, v_after_id;
  end if;
  if v_before_created_by is distinct from v_after_created_by then
    raise exception 'INVARIANT FAILED: created_by changed (% -> %)', v_before_created_by, v_after_created_by;
  end if;
  if v_before_created_at is distinct from v_after_created_at then
    raise exception 'INVARIANT FAILED: created_at changed (% -> %)', v_before_created_at, v_after_created_at;
  end if;
  if v_after_org_id is null then
    raise exception 'INVARIANT FAILED: organization_id is still null after migration';
  end if;

  -- 2. No duplicate Vrindavan row was created.
  select count(*) into v_vrindavan_count_after from public.productions where name = 'Vrindavan Mein Param Aanand';
  if v_vrindavan_count_after != 1 then
    raise exception 'INVARIANT FAILED: expected exactly 1 Vrindavan row after migration, found %', v_vrindavan_count_after;
  end if;

  -- 3. Organization name is exactly "GSK Productions Inc."
  select o.name into v_org_name from public.organizations o where o.id = v_after_org_id;
  if v_org_name is distinct from 'GSK Productions Inc.' then
    raise exception 'INVARIANT FAILED: organization name is ''%'', expected ''GSK Productions Inc.''', v_org_name;
  end if;

  -- 4. Every production has an organization.
  select count(*) into v_missing_org_count from public.productions where organization_id is null;
  if v_missing_org_count != 0 then
    raise exception 'INVARIANT FAILED: % production(s) still missing organization_id', v_missing_org_count;
  end if;

  -- 5. production_members is byte-identical to the baseline (row-for-row, both directions).
  select count(*) into v_before_members_count from _p1a_before_members;
  select count(*) into v_after_members_count from public.production_members
    where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');
  if v_before_members_count != v_after_members_count then
    raise exception 'INVARIANT FAILED: production_members row count changed (% -> %)', v_before_members_count, v_after_members_count;
  end if;

  select count(*) into v_members_diff_count from (
    (select production_id, user_id, role from _p1a_before_members
     except
     select production_id, user_id, role from public.production_members
       where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand'))
    union all
    (select production_id, user_id, role from public.production_members
       where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')
     except
     select production_id, user_id, role from _p1a_before_members)
  ) x;
  if v_members_diff_count != 0 then
    raise exception 'INVARIANT FAILED: production_members rows differ from baseline (% mismatched row(s))', v_members_diff_count;
  end if;

  -- 6. Every content-table count is unchanged.
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
  from _p1a_before_counts b;

  if not v_counts_match then
    raise exception 'INVARIANT FAILED: one or more content-table counts changed for Vrindavan Mein Param Aanand';
  end if;

  raise notice 'ALL P1A INVARIANTS PASSED for Vrindavan Mein Param Aanand — safe to commit.';
end $$;

commit;
```

If this script's `commit;` at the end runs without any `raise exception` having fired, every invariant above held and the migration is applied. If any check fails, Postgres has already rolled back the entire transaction — the migration's DDL/DML included — before the error message reaches you; nothing is left half-applied.

**This exact script was tested against real, local PostgreSQL 16 in three scenarios before being added here, not just written and assumed correct:**

1. **Success path** — populated test database (simulated Vrindavan plus a second production, with real content rows attached). Ran to completion, printed `ALL P1A INVARIANTS PASSED`, committed. Confirmed afterward: both productions correctly backfilled into one "GSK Productions Inc." organization, and the temp tables were gone (`on commit drop` cleaned them up automatically).
2. **Pre-flight abort** — a database with two distinct production creators. The script raised `PRE-FLIGHT ABORT` before touching anything and rolled back. Confirmed afterward: the `organizations` table doesn't even exist, `productions.organization_id` doesn't exist, both productions and their membership rows are completely unchanged.
3. **Post-migration invariant failure** — a deliberately sabotaged copy of this exact script (one extra statement injected right after the migration body to corrupt the organization's name) to prove the rollback catches a genuine failure occurring *after* the DDL has already run, not just a failure that happens to occur before it. The script raised `INVARIANT FAILED` and rolled back. Confirmed afterward: `organizations` table doesn't exist, `organization_id` column doesn't exist, Vrindavan's row and its content (a test character row) are completely untouched — everything the migration had already done inside the transaction was undone.

## Why this migration does not touch Vrindavan's identity or content

- **Not name-matched.** The migration never searches for `'Vrindavan Mein Param Aanand'` by name or looks up its `production_id`. A name search is fragile — a whitespace or capitalization difference would silently fail to match and leave the row un-backfilled. Instead, the backfill is driven entirely by `productions.created_by` and `productions.created_at`, columns that already exist and already apply to every row, Vrindavan's included, without this migration needing to know its id in advance.
- **No existing row is updated except to add the one new column's value.** `id`, `name`, `phase`, `script_revision_color`, `created_by`, `created_at` on `productions` are never written to by this migration.
- **No screenplay, scene, cast, crew, schedule, call sheet, document, or file data is touched.** The migration contains no statement referencing `scenes`, `characters`, `cast_members`, `crew_members`, `shoot_days`, `call_sheets`, `documents`, `script_pages`, `breakdown_elements`, or any storage bucket. Grep-verifiable: `grep -iE "scenes|cast_members|crew_members|shoot_days|call_sheets|script_pages|breakdown_elements" packages/db/migrations/0016_organization_governance.sql` returns nothing.
- **`production_members` and its RLS policies are completely untouched.** Who can see or edit Vrindavan's data is still decided entirely by `production_members` (0001_rls_and_auth_trigger.sql), exactly as before this migration. The new `organizations`/`organization_memberships` tables and their RLS policies are additive and independent — they gate access to organization rows only, not production rows.

## Backfill logic, in full

```sql
insert into public.organizations (id, name, created_by, created_at)
select
  'org_' || replace(gen_random_uuid()::text, '-', ''),
  'GSK Productions Inc.',
  p.created_by,
  now()
from public.productions p
order by p.created_at asc
limit 1;

insert into public.organization_memberships (organization_id, user_id, role, created_at)
select o.id, o.created_by, 'Owner', now()
from public.organizations o;

update public.productions
set organization_id = (select id from public.organizations limit 1)
where organization_id is null;

alter table public.productions alter column organization_id set not null;
```

Safe on a database with zero productions too (every statement above is then a no-op with nothing to act on, and the final `NOT NULL` constraint applies cleanly since no row violates it) — verified directly, see below.

## Verification performed before this PR was opened

I do not have credentials for the live Supabase database, so nothing below was run against the real Vrindavan data — that verification is the owner's to run (queries provided further down). What I could and did do: apply the **exact migration file being merged** against a fresh, local, throwaway PostgreSQL 16 instance, stubbing only the Supabase-managed pieces this schema depends on (`auth.users`, `auth.uid()`, `storage.buckets`/`storage.objects` — infrastructure Supabase itself provides, not part of this PR).

Steps actually run, in order:

1. Applied migrations `0000` through `0015` (the entire existing migration history) against a clean database — establishes the exact starting shape a real Supabase database is in today.
2. Inserted two simulated pre-existing productions: one named `Vrindavan Mein Param Aanand` (earliest `created_at`, standing in for the real one), one named `THE BAND` (the seeded fixture production), both owned by a simulated user with `production_members` rows — standing in for the real database's actual state before this migration runs.
3. Applied `0016_organization_governance.sql` — **zero errors.**
4. Queried the result directly:
   - Exactly one organization created, named `GSK Productions Inc.`
   - Both productions backfilled to that one organization, preserving `id`, `created_by`, `created_at` unchanged
   - `organization_id` confirmed `NOT NULL` at the schema level
   - `production_members` rows unchanged (2 rows, same as before)
5. Switched to the `authenticated` Postgres role (not superuser — RLS actually enforced) and set the session to the simulated owner: confirmed they still see both productions, both membership rows, and the one organization. Switched to a simulated stranger with no membership anywhere: confirmed they see **zero** productions and **zero** organizations.
6. Confirmed the `NOT NULL` constraint is real, not just declared: attempted an insert into `productions` with no `organization_id` — rejected by Postgres with a constraint violation, as expected.
7. Applied the full migration chain (`0000`–`0016`) against a **second, completely empty** database — zero errors, zero organizations or productions created, confirming the zero-row case is safe (this is the shape of a fresh CI/dev database).
8. Wrote and applied the rollback (below) against the populated test database from steps 1–4: `organizations`/`organization_memberships` dropped, `productions.organization_id` column dropped, and — verified directly — `productions` and `production_members` came back byte-identical to their pre-migration state (same rows, same columns, same policies, same foreign keys).

This is real execution against real PostgreSQL, not a syntax read-through — but it is still a simulation with synthetic data, not the live database. The verification queries below are what confirms the real thing.

## Rollback

See the "Owner Runbook" above — the normal path is `rollback;` inside Step 4's still-open transaction (nothing was ever committed, so nothing needs undoing). The "Emergency rollback" block in that same section is the SQL to use only if a bad result was already committed. Both are verified end-to-end against the populated test database (Verification step 8 below) — applying it after the migration restores `productions` to its exact pre-migration column set, policies, and data.

### What's code-provable vs. what needs live confirmation

| Claim | How it's known |
|---|---|
| Migration applies without SQL errors | **Proven** — executed against real PostgreSQL 16 in this PR's verification (see below) |
| Vrindavan's `id`/`created_by`/`created_at` unchanged | **Proven in simulation** (synthetic data standing in for Vrindavan) — Runbook Step 3a is the live confirmation |
| Every production ends up in exactly one organization | **Proven in simulation** — Runbook Step 3g is the live confirmation |
| `production_members` unaffected | **Proven in simulation** — Runbook Step 3e is the live confirmation |
| RLS isolation unaffected | **Proven in simulation**, including a live RLS test as a non-superuser role (owner vs. stranger) — the SQL Editor itself cannot re-prove this behaviorally (superuser bypasses RLS); Runbook Step 3h confirms the policies are structurally unchanged, which combined with Step 3e is the strongest live confirmation available from SQL Editor alone |
| No screenplay/scene/cast/crew/schedule/file content altered | **Structurally guaranteed** — the migration file contains no reference to any of those tables (grep-verifiable) — Runbook Step 3f is an optional extra check, not required to prove this since the migration literally cannot touch those tables |
| Rollback restores exact pre-migration state | **Proven in simulation** (Verification step 8 below) — not something that needs live re-verification unless the rollback is actually used |

## Known limitations / risks before applying to live Supabase

1. **This migration has not been run against the live database.** Everything above is simulation-verified, not production-verified. Recommend: run it during a low-traffic window, and run the "before" verification queries first so there's a real baseline to diff against.
2. **App-layer trust, not RLS, currently guarantees a new production's `organization_id` belongs to an org its creator is a member of.** `apps/web/app/production-actions.ts`'s `createProduction` looks up-or-creates the caller's own organization and uses its id — correct by construction, but nothing in `productions`' RLS `INSERT` policy independently re-checks that the supplied `organization_id` is one the caller belongs to (that policy is unchanged from before this PR — see "Deliberately NOT changed" note in the migration file). A defense-in-depth RLS check here is a reasonable P1b follow-up, not done in P1a to keep this PR's RLS surface minimal and match the explicit no-authorize()-engine-yet scope.
3. **Every production currently lands in one single organization.** That's correct for today's single-owner state of the app, but if a second, unrelated owner's productions exist in the live database that this analysis doesn't know about, they would also be swept into "GSK Productions Inc." — worth confirming with the "before" baseline query (`select distinct created_by from public.productions`) before running this in production. [Requires live confirmation.]
4. **`gen_random_uuid()` requires the `pgcrypto` extension.** Supabase enables this by default; if the live database somehow doesn't have it, the organization-id generation step would fail loudly (not silently) rather than corrupt data — but worth a quick `select extname from pg_extension where extname = 'pgcrypto';` check before running.

## Acceptance tests — mapped to what verifies each one

| Required acceptance test | Verified how |
|---|---|
| Existing user can still access the same production after migration | Simulated: owner role query returned both productions post-migration, identical to pre-migration membership |
| Existing `production_id` references are unchanged | Simulated: `id`, `created_by`, `created_at` compared before/after — identical |
| Production belongs to exactly one organization | Schema-level: `organization_id` is a single non-null column, `NOT NULL` confirmed live against the test database |
| Organization membership exists for the current owner | Simulated: `organization_memberships` row confirmed present with role `Owner` |
| RLS production isolation remains intact | Simulated, with a real RLS test as the non-superuser `authenticated` role: owner sees their productions, an unrelated user sees none — and `production_members`' policies are byte-unchanged from 0001 |
| No table unrelated to organization governance is modified | Structural: the migration file's only `alter table` statements target `productions` (add one column) — grep-verifiable, no other table is referenced by any `alter`/`create`/`drop` statement |
