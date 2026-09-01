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

Reverses only what this migration added. Never touches `productions` (beyond dropping the one column), `production_members`, or any production-scoped table.

```sql
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
```

Verified end-to-end against the populated test database (step 8 above) — applying this after the migration restores `productions` to its exact pre-migration column set, policies, and data.

## Verification queries for the owner — run in Supabase SQL Editor

### Before applying the migration (baseline — confirms current state)

```sql
-- Vrindavan's current identity, for comparison after migration.
select id, name, created_by, created_at
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- Confirm production_members today.
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');
```

Save this output somewhere before proceeding — it's what the "after" queries below get compared against.

### After applying the migration

```sql
-- 1. Vrindavan's id, created_by, and created_at must be IDENTICAL to the baseline above.
select id, name, created_by, created_at, organization_id
from public.productions
where name = 'Vrindavan Mein Param Aanand';

-- 2. Exactly one organization exists, and Vrindavan belongs to it.
select o.id, o.name, o.created_by, o.created_at
from public.organizations o
join public.productions p on p.organization_id = o.id
where p.name = 'Vrindavan Mein Param Aanand';

-- 3. The organization has exactly the expected owner as a member.
select om.organization_id, om.user_id, om.role
from public.organization_memberships om
join public.productions p on p.organization_id = om.organization_id
where p.name = 'Vrindavan Mein Param Aanand';

-- 4. production_members is byte-identical to the baseline (same rows).
select production_id, user_id, role
from public.production_members
where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand');

-- 5. organization_id is NOT NULL for every production (structural check).
select count(*) as productions_missing_org
from public.productions
where organization_id is null;
-- Expect 0.

-- 6. No production belongs to more than one organization (trivially true —
-- organization_id is a single column — but confirms the column type/shape).
select id, count(*) from public.productions group by id having count(*) > 1;
-- Expect 0 rows.

-- 7. Sanity check that no production-content table was touched: row counts
-- for scenes/cast/crew/shoot_days should match whatever they were before
-- this migration ran (compare against your own pre-migration count if you
-- want extra assurance — this migration doesn't reference these tables at
-- all, so they cannot have changed).
select
  (select count(*) from public.scenes where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as scenes,
  (select count(*) from public.cast_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as cast_members,
  (select count(*) from public.crew_members where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as crew_members,
  (select count(*) from public.shoot_days where production_id = (select id from public.productions where name = 'Vrindavan Mein Param Aanand')) as shoot_days;
```

### What's code-provable vs. what needs live confirmation

| Claim | How it's known |
|---|---|
| Migration applies without SQL errors | **Proven** — executed against real PostgreSQL 16 in this PR's verification (see above) |
| Vrindavan's `id`/`created_by`/`created_at` unchanged | **Proven in simulation** (synthetic data standing in for Vrindavan) — needs query 1 above run against the real row for final confirmation |
| Every production ends up in exactly one organization | **Proven in simulation** — needs query 5 above against real data |
| `production_members` / RLS isolation unaffected | **Proven in simulation**, including a live RLS test (owner vs. stranger role) — needs query 4 above against real data for final confirmation |
| No screenplay/scene/cast/crew/schedule/file content altered | **Structurally guaranteed** — the migration file contains no reference to any of those tables (grep-verifiable) — query 7 above is an optional extra check, not required to prove this since the migration literally cannot touch those tables |
| Rollback restores exact pre-migration state | **Proven in simulation** (step 8 above) — not something that needs live re-verification unless the rollback is actually used |

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
