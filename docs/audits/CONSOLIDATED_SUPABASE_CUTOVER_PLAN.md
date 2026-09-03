# Consolidated Supabase Cutover Plan

**Living document — updated every time a new migration is added to the pending set.** This is the single source of truth for the eventual one-time live Supabase cutover the owner has decided to do as one controlled event rather than per-PR. Nothing in this document has been run against live Supabase. Everything in it has been run, repeatedly, against real local PostgreSQL 16.

## Pending migrations, in order

| # | File | PR | Adds | Status |
|---|---|---|---|---|
| 1 | `packages/db/migrations/0016_organization_governance.sql` | [#24](https://github.com/gskfilmmaker/FilmSet/pull/24) (draft, base `main`) | `organizations`, `organization_memberships`, `productions.organization_id` | Locally verified, not live |
| 2 | `packages/db/migrations/0017_authorization_foundation.sql` | [#25](https://github.com/gskfilmmaker/FilmSet/pull/25) (draft, base `claude/p1a-organization-governance` — stacked on #24) | `permissions`, `roles`, `role_permissions`, `production_members.role_id`/`.status`/`.effective_from`/`.effective_until`, `departments`, `department_memberships`, `department_head_assignments`, `department_permissions`, `department_budget_scopes` | Locally verified, not live |
| 3 | `packages/db/migrations/0018_booking_approval_engine.sql` | P5 (draft, base `claude/p4-logistics-readiness` — stacked on #29) | `bookings`, `booking_quotes`, `booking_confirmations`, `booking_changes`, `booking_cancellations`, `approval_workflows`, `approval_stages`, `approval_rules`, `approval_requests`, `approval_decisions`, `commitments`, `invoices`, `expenses.booking_id` | Locally verified, not live |

PRs #26 (P1c), #27 (P2), #28 (P3), and #29 (P4) added no migrations — docs and/or application-layer code only, stacked in sequence, nothing to add to this table. P5 is the first PR since #25 to add schema.

## Combined atomic cutover script

One paste, one execution, one transaction — applies both pending migrations in sequence and checks invariants for both before ever committing. Built and tested exactly the same way as each migration's own individual atomic script (see `VRINDAVAN_MIGRATION_IMPACT.md`), concatenated in migration order with one combined pre-flight and one combined post-check.

**Revised after the first real pre-flight run against live Supabase caught a wrong assumption.** The original version of this script matched Vrindavan by name (capital P) and required exactly one production and one distinct creator. A real, read-only check against live Supabase (run by the owner's chosen cutover operator, before ever touching anything) found: the real name is spelled `'Vrindavan Mein param Aanand'` (lowercase p); two rows carry that exact name; and three productions exist across two distinct creators (`gskcreatives@gmail.com`, owner of `THE BAND`; `gskproductionsinc@gmail.com`, owner of both Vrindavan rows — confirmed by the owner to be the same company on two accounts). The pre-flight correctly aborted before touching anything. See `VRINDAVAN_MIGRATION_IMPACT.md`'s P1a section for the full account of what was found and fixed — the same fix (migration 0016's org-membership backfill now covers every distinct creator, not just one; the pre-flight/post-check below is now anchored to the three specific reviewed production ids, not name/count heuristics) is what's pasted into the combined script below.

**Tested against real, local PostgreSQL 16, both this revision and the original:**
- **Success**: applied against a database seeded to the exact live shape the pre-flight check reported (three productions — `THE BAND` empty, plus the two Vrindavan rows with their real ids/creators/timestamps — two distinct creators) — committed cleanly, printed `ALL CUTOVER INVARIANTS PASSED (0016 + 0017 + 0018)`. Confirmed afterward: 71 permissions, 27 roles, 25 × 3 departments, `production_members.role_id` backfilled, both distinct creators are now Owner members of the one organization, the authoritative Vrindavan production's `id`/`created_by`/`created_at` unchanged, and the older duplicate plus `THE BAND` are unchanged except for gaining `organization_id`.
- **Failure**: applied against a database missing one of the three known productions — the pre-flight check aborted before any migration's DDL ran, naming exactly which expected production wasn't found, and every subsequent statement in the batch correctly failed as "transaction is aborted." Confirmed afterward: neither `organizations` nor `permissions` tables exist, the productions that did exist were completely untouched.
- **0018 addition**: migration itself verified separately against real Postgres (18 prior migrations applied in sequence, then 0018) — full functional pass through Booking → Approval Engine → Commitment → Invoice → linked `expenses` Actual, plus RLS confirmed three ways as the real `authenticated` role: a production member reads every row in the chain, a cross-production outsider reads zero rows, and an authenticated insert is correctly denied (no write policy exists, matching every other table this cutover adds). 0018 is purely additive (new tables + one nullable column) with no existing-data risk, so it doesn't need its own separate success/failure scenario pair the way 0016 (which alters real production rows) did — its invariants below are folded into the same combined script and post-check.

```sql
begin;

-- ============================================================================
-- PRE-FLIGHT — aborts before touching anything unless the live database
-- still matches exactly the state reviewed with the owner: three specific
-- productions, by id and name, no more, no fewer. See
-- VRINDAVAN_MIGRATION_IMPACT.md's P1a section for the full account of why
-- this replaced the original name/count-based check.
-- ============================================================================
do $$
declare
  v_band_count int;
  v_vrindavan_new_count int;
  v_vrindavan_old_count int;
  v_total_count int;
begin
  select count(*) into v_band_count from public.productions
    where id = '27b53fc1-f331-4914-85df-3e5958f76fe5' and name = 'THE BAND';
  if v_band_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: expected production 27b53fc1-f331-4914-85df-3e5958f76fe5 named ''THE BAND'', found %. Live data no longer matches the reviewed state — stop and re-verify.', v_band_count;
  end if;

  select count(*) into v_vrindavan_new_count from public.productions
    where id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6' and name = 'Vrindavan Mein param Aanand';
  if v_vrindavan_new_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: expected the authoritative Vrindavan production a5d6802a-b40c-475e-8336-eda13cdc3bf6 named ''Vrindavan Mein param Aanand'', found %. Not safe to proceed.', v_vrindavan_new_count;
  end if;

  select count(*) into v_vrindavan_old_count from public.productions
    where id = '84aa7175-f464-41a0-a6d5-bd330cdb0468' and name = 'Vrindavan Mein param Aanand';
  if v_vrindavan_old_count != 1 then
    raise exception 'PRE-FLIGHT ABORT: expected the older duplicate Vrindavan production 84aa7175-f464-41a0-a6d5-bd330cdb0468 named ''Vrindavan Mein param Aanand'', found %. Live data no longer matches the reviewed state — stop and re-verify.', v_vrindavan_old_count;
  end if;

  select count(*) into v_total_count from public.productions;
  if v_total_count != 3 then
    raise exception 'PRE-FLIGHT ABORT: expected exactly 3 productions total (matching the reviewed live state), found %. A production may have been added or removed since review — stop and re-verify before proceeding.', v_total_count;
  end if;
end $$;

-- ============================================================================
-- BEFORE baseline — captured into temp tables, dropped automatically at
-- commit or rollback. Anchored to the authoritative Vrindavan production's
-- id (owner-confirmed), not its name — two rows share that name live.
-- ============================================================================
create temp table _cutover_before_production on commit drop as
select id, name, created_by, created_at
from public.productions
where id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6';

create temp table _cutover_before_members on commit drop as
select production_id, user_id, role
from public.production_members
where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6';

create temp table _cutover_before_counts on commit drop as
select
  (select count(*) from public.scenes where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as scenes,
  (select count(*) from public.characters where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as characters,
  (select count(*) from public.cast_members where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as cast_members,
  (select count(*) from public.crew_members where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as crew_members,
  (select count(*) from public.shoot_days where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as shoot_days,
  (select count(*) from public.script_pages where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as script_pages,
  (select count(*) from public.breakdown_elements where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as breakdown_elements,
  (select count(*) from public.call_sheets where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as call_sheets,
  (select count(*) from public.documents where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as documents,
  (select count(*) from public.expenses where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6') as expenses;

-- Baseline the two other known productions' identity too, so the post-check
-- can confirm they were left untouched other than gaining an organization_id.
create temp table _cutover_before_others on commit drop as
select id, name, created_by, created_at
from public.productions
where id in ('84aa7175-f464-41a0-a6d5-bd330cdb0468', '27b53fc1-f331-4914-85df-3e5958f76fe5');

create temp table _cutover_before_production_count on commit drop as
select count(*) as n from public.productions;

-- ============================================================================
-- BEGIN packages/db/migrations/0016_organization_governance.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P1a — Organization / Production governance foundation. See
-- docs/audits/VRINDAVAN_MIGRATION_IMPACT.md for the full impact analysis,
-- rollback plan, and verification queries before running this against a
-- database that holds real production data.
--
-- Scope, deliberately: an organization layer ABOVE productions, and nothing
-- else. No Department schema, no centralized authorize() engine, no change
-- to how production access is granted — production_members and its RLS
-- policies (0001_rls_and_auth_trigger.sql) are completely untouched by this
-- migration. That is intentional: P1a must not alter who can see or edit
-- Vrindavan Mein Param Aanand's data, only add a governance layer above it.
-- ============================================================================

-- ============================================================================
-- organizations / organization_memberships — new tables, additive only.
-- ============================================================================
create table public.organizations (
  id text primary key,
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Owner',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ============================================================================
-- productions.organization_id — added NULLABLE first, deliberately: the
-- backfill below must be able to populate every existing row (including
-- Vrindavan Mein Param Aanand's) before the NOT NULL constraint locks it
-- in. No existing production row's id, name, phase, script_revision_color,
-- created_by, or created_at changes — this only adds a new column.
-- ============================================================================
alter table public.productions add column organization_id text references public.organizations(id) on delete restrict;

-- ============================================================================
-- Backfill — data-driven, not name-matched. This migration does not search
-- for "Vrindavan Mein Param Aanand" by name or id (fragile — a whitespace
-- or capitalization difference would silently fail to match). Instead it
-- creates exactly one organization, "GSK Productions Inc." (the owner's
-- named company — already used as the app's own brand-footer credit, see
-- apps/web/components/shell.tsx's BrandFooter), and backfills every
-- existing production into it.
--
-- Live-data correction (found via the actual pre-cutover read-only check
-- against Supabase, before this migration was ever run live): the account
-- is not single-owner. Real productions exist with two distinct
-- `created_by` values (gskcreatives@gmail.com and
-- gskproductionsinc@gmail.com — confirmed by the owner to be the same
-- company operating under two accounts). The org itself still has exactly
-- one `created_by` (whichever user created the earliest-existing
-- production row, for a stable, deterministic choice — this only affects
-- the `organizations.created_by` column, not who has access), but
-- membership is backfilled for EVERY distinct production creator, not
-- just the org's own `created_by` — otherwise a second real account whose
-- productions get placed in this org would not itself be a member of it.
-- Safe even if productions has zero rows (a fresh database, e.g. local
-- dev or CI) — every statement below is then a no-op with no rows to act
-- on, and the final NOT NULL constraint still applies cleanly since no
-- row would violate it. Also safe and correct for the original
-- single-owner case (one distinct creator resolves to one membership row,
-- identical to the previous behavior).
-- ============================================================================
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
select o.id, creators.created_by, 'Owner', now()
from public.organizations o
cross join (select distinct created_by from public.productions) creators
on conflict (organization_id, user_id) do nothing;

update public.productions
set organization_id = (select id from public.organizations limit 1)
where organization_id is null;

-- Now safe: every existing row (if any) has a value.
alter table public.productions alter column organization_id set not null;

create index organizations_created_by_idx on public.organizations (created_by);
create index organization_memberships_user_idx on public.organization_memberships (user_id);
create index productions_organization_idx on public.productions (organization_id);

-- ============================================================================
-- Helper predicates — mirrors is_production_member/is_production_owner
-- exactly (0001_rls_and_auth_trigger.sql). security definer so they bypass
-- RLS internally, avoiding infinite recursion when an
-- organization_memberships policy calls one of these.
-- ============================================================================
create or replace function public.is_organization_member(target_organization_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_owner(target_organization_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.role = 'Owner'
  );
$$;

grant execute on function public.is_organization_member(text) to authenticated;
grant execute on function public.is_organization_owner(text) to authenticated;

-- ============================================================================
-- organizations RLS — mirrors the productions pattern (0001): select as any
-- member, insert only for yourself, update/delete restricted to Owners.
-- ============================================================================
alter table public.organizations enable row level security;

create policy "select organizations as member" on public.organizations for select
  to authenticated
  using (public.is_organization_member(id));

create policy "insert own organization" on public.organizations for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "update organizations as owner" on public.organizations for update
  to authenticated
  using (public.is_organization_owner(id))
  with check (public.is_organization_owner(id));

create policy "delete organizations as owner" on public.organizations for delete
  to authenticated
  using (public.is_organization_owner(id));

-- ============================================================================
-- organization_memberships RLS — mirrors production_members exactly (0001).
-- ============================================================================
alter table public.organization_memberships enable row level security;

create policy "select org memberships as member" on public.organization_memberships for select
  to authenticated
  using (user_id = auth.uid() or public.is_organization_member(organization_id));

create policy "insert own org membership or owner adds member" on public.organization_memberships for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_organization_owner(organization_id));

create policy "update org memberships as owner" on public.organization_memberships for update
  to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

create policy "delete org memberships as owner or self" on public.organization_memberships for delete
  to authenticated
  using (user_id = auth.uid() or public.is_organization_owner(organization_id));

-- ============================================================================
-- Deliberately NOT changed by this migration (documented so a future PR
-- doesn't have to rediscover why):
--
-- - The "select productions as member" / "insert own production" / "update
--   productions as owner" / "delete productions as owner" policies on
--   public.productions are untouched. Production access is still decided
--   entirely by production_members, not by organization membership. Wiring
--   organization-level authorization into production access is explicitly
--   out of scope for P1a (that belongs to P1b's authorize() engine) — see
--   docs/audits/VRINDAVAN_MIGRATION_IMPACT.md's "Known limitations" section
--   for the resulting gap (app-code, not RLS, currently guarantees a new
--   production's organization_id belongs to an org its creator is a member
--   of).
-- - profiles, production_members, and every production-scoped table's RLS
--   policy is untouched.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0016_organization_governance.sql
-- ============================================================================

-- ============================================================================
-- BEGIN packages/db/migrations/0017_authorization_foundation.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P1b — Authorization foundation: permission vocabulary, role templates,
-- and the Department/HOD model. See docs/audits/VRINDAVAN_MIGRATION_IMPACT.md
-- for the full impact analysis, rollback plan, and verification queries
-- before running this against a database that holds real production data.
--
-- Scope, deliberately: schema + seed data only. Nothing in this migration
-- changes how any existing screen or Server Action behaves — RLS on every
-- existing table, production_members' `role` text column, and every
-- current `assertRole()` call are completely untouched. `authorize()`
-- (packages/auth/src/authorize.ts) is new code this schema backs, not yet
-- called from anywhere in apps/web.
-- ============================================================================

-- ============================================================================
-- permissions — vocabulary catalog (docs/security/PERMISSION_MATRIX_V1.md
-- §1-2). Fixed rows, not user-editable through any UI in this phase.
-- ============================================================================
create table public.permissions (
  key text primary key,
  domain text not null,
  action text not null,
  description text not null
);

insert into public.permissions (key, domain, action, description) values
  ('schedule.view', 'schedule', 'view', 'View the shoot schedule'),
  ('schedule.manage', 'schedule', 'manage', 'Manage the shoot schedule'),
  ('schedule.publish', 'schedule', 'publish', 'Publish the shoot schedule'),
  ('script.view', 'script', 'view', 'View the script'),
  ('script.manage', 'script', 'manage', 'Manage the script'),
  ('script.import', 'script', 'import', 'Import a script revision'),
  ('breakdown.view', 'breakdown', 'view', 'View script breakdown elements'),
  ('breakdown.manage', 'breakdown', 'manage', 'Manage script breakdown elements'),
  ('cast.view', 'cast', 'view', 'View cast records'),
  ('cast.view_sensitive', 'cast', 'view_sensitive', 'View sensitive cast fields (contact, sizing)'),
  ('cast.manage', 'cast', 'manage', 'Manage cast records'),
  ('crew.view', 'crew', 'view', 'View crew records'),
  ('crew.view_sensitive', 'crew', 'view_sensitive', 'View sensitive crew fields (contact)'),
  ('crew.manage', 'crew', 'manage', 'Manage crew records'),
  ('locations.view', 'locations', 'view', 'View locations'),
  ('locations.manage', 'locations', 'manage', 'Manage locations'),
  ('callsheet.view', 'callsheet', 'view', 'View call sheets'),
  ('callsheet.manage', 'callsheet', 'manage', 'Manage call sheets'),
  ('callsheet.publish', 'callsheet', 'publish', 'Publish a call sheet'),
  ('callsheet.distribute', 'callsheet', 'distribute', 'Distribute a call sheet'),
  ('budget.view_summary', 'budget', 'view_summary', 'View budget summary'),
  ('budget.view_detail', 'budget', 'view_detail', 'View detailed budget lines'),
  ('budget.manage', 'budget', 'manage', 'Manage the budget'),
  ('budget.approve', 'budget', 'approve', 'Approve budget changes'),
  ('expenses.view', 'expenses', 'view', 'View expenses'),
  ('expenses.create', 'expenses', 'create', 'Create an expense'),
  ('expenses.approve', 'expenses', 'approve', 'Approve an expense'),
  ('documents.view', 'documents', 'view', 'View documents'),
  ('documents.upload', 'documents', 'upload', 'Upload a document'),
  ('documents.download_original', 'documents', 'download_original', 'Download the unwatermarked original of a document'),
  ('documents.delete', 'documents', 'delete', 'Delete a document'),
  ('contracts.view', 'contracts', 'view', 'View contracts / deal memos'),
  ('contracts.view_sensitive', 'contracts', 'view_sensitive', 'View sensitive contract terms (compensation, payment info)'),
  ('contracts.manage', 'contracts', 'manage', 'Manage contracts / deal memos'),
  ('travel.view', 'travel', 'view', 'View travel bookings'),
  ('travel.manage', 'travel', 'manage', 'Manage travel bookings'),
  ('travel.approve', 'travel', 'approve', 'Approve a travel booking'),
  ('accommodation.view', 'accommodation', 'view', 'View accommodation bookings'),
  ('accommodation.manage', 'accommodation', 'manage', 'Manage accommodation bookings'),
  ('accommodation.approve', 'accommodation', 'approve', 'Approve an accommodation booking'),
  ('transport.view', 'transport', 'view', 'View transport/movements'),
  ('transport.manage', 'transport', 'manage', 'Manage transport/movements'),
  ('transport.approve', 'transport', 'approve', 'Approve a transport booking'),
  ('catering.dietary.view_individual', 'catering.dietary', 'view_individual', 'View a named individual''s dietary profile'),
  ('catering.dietary.view_operational', 'catering.dietary', 'view_operational', 'View a service''s dietary needs without names attached'),
  ('catering.counts.view_aggregate', 'catering.counts', 'view_aggregate', 'View aggregate meal counts only'),
  ('catering.manage', 'catering', 'manage', 'Manage catering'),
  ('catering.approve', 'catering', 'approve', 'Approve a catering order'),
  ('bookings.view', 'bookings', 'view', 'View bookings (cross-cutting)'),
  ('bookings.manage', 'bookings', 'manage', 'Manage bookings (cross-cutting)'),
  ('bookings.approve', 'bookings', 'approve', 'Approve a booking (cross-cutting)'),
  ('departments.view', 'departments', 'view', 'View department structure'),
  ('departments.manage', 'departments', 'manage', 'Manage department structure'),
  ('departments.assign_hod', 'departments', 'assign_hod', 'Assign a department head'),
  ('ai.suggest.trigger', 'ai', 'suggest.trigger', 'Trigger an AI suggestion'),
  ('ai.suggestion.approve', 'ai', 'suggestion.approve', 'Approve an AI suggestion'),
  ('ai.log.view', 'ai', 'log.view', 'View the AI suggestion log'),
  ('security.users.view', 'security.users', 'view', 'View users'),
  ('security.users.manage', 'security.users', 'manage', 'Manage users'),
  ('security.roles.view', 'security.roles', 'view', 'View roles'),
  ('security.roles.manage', 'security.roles', 'manage', 'Manage roles'),
  ('security.sessions.view', 'security.sessions', 'view', 'View sessions'),
  ('security.sessions.revoke', 'security.sessions', 'revoke', 'Revoke a session'),
  ('security.audit.view', 'security.audit', 'view', 'View the audit log'),
  ('security.audit.export', 'security.audit', 'export', 'Export the audit log'),
  ('security.api.manage', 'security.api', 'manage', 'Manage API/integration credentials'),
  ('permissions.view', 'permissions', 'view', 'View permission grants'),
  ('permissions.manage', 'permissions', 'manage', 'Manage permission grants'),
  ('production.manage', 'production', 'manage', 'Manage production settings'),
  ('production.delete', 'production', 'delete', 'Delete a production'),
  ('organization.manage', 'organization', 'manage', 'Manage organization settings');

-- ============================================================================
-- roles — named permission bundles (PERMISSION_MATRIX_V1.md §4).
-- organization_id null = system template, shared by every organization.
-- ============================================================================
create table public.roles (
  id text primary key,
  organization_id text references public.organizations(id) on delete cascade,
  name text not null,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_org_name_unique unique (organization_id, name)
);

create table public.role_permissions (
  role_id text not null references public.roles(id) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission)
);

-- Seed system template roles. IDs are stable, human-readable slugs (not
-- random) so role_permissions inserts below and any future reference to a
-- specific template role stay readable and reproducible across
-- environments.
insert into public.roles (id, organization_id, name, is_system_template) values
  ('role_platform_security_admin', null, 'Platform Security Admin', true),
  ('role_organization_owner', null, 'Organization Owner', true),
  ('role_organization_admin', null, 'Organization Admin', true),
  ('role_production_super_admin', null, 'Production Super Admin', true),
  ('role_executive_producer', null, 'Executive Producer', true),
  ('role_producer', null, 'Producer', true),
  ('role_line_producer', null, 'Line Producer', true),
  ('role_upm', null, 'UPM', true),
  ('role_production_manager', null, 'Production Manager', true),
  ('role_production_coordinator', null, 'Production Coordinator', true),
  ('role_apoc', null, 'APOC', true),
  ('role_1st_ad', null, '1st AD', true),
  ('role_2nd_ad', null, '2nd AD', true),
  ('role_department_head', null, 'Department Head', true),
  ('role_department_coordinator', null, 'Department Coordinator', true),
  ('role_department_member', null, 'Department Member', true),
  ('role_production_accountant', null, 'Production Accountant', true),
  ('role_travel_coordinator', null, 'Travel Coordinator', true),
  ('role_transport_coordinator', null, 'Transport Coordinator', true),
  ('role_catering_head', null, 'Catering Head', true),
  ('role_booking_manager', null, 'Booking Manager', true),
  ('role_cast', null, 'Cast', true),
  ('role_background', null, 'Background', true),
  ('role_vendor', null, 'Vendor', true),
  ('role_external_viewer', null, 'External Viewer', true),
  -- Not in PERMISSION_MATRIX_V1.md's tier table, but preserved from the
  -- app's current PRODUCTION_ROLES vocabulary (packages/auth/src/index.ts)
  -- so every existing production_members.role value maps onto a real role
  -- below (see the backfill further down) — no row is left without a
  -- roleId after this migration.
  ('role_director', null, 'Director', true),
  ('role_crew', null, 'Crew', true);

-- Platform Security Admin: every security.*/permissions.* permission,
-- across every org/production (PERMISSION_MATRIX_V1.md §4) — the one role
-- authorize() must treat as bypassing normal org/production scoping
-- entirely; that scoping exception lives in application code
-- (packages/auth/src/authorize.ts), not in this data.
insert into public.role_permissions (role_id, permission)
select 'role_platform_security_admin', key from public.permissions
where domain like 'security.%' or domain = 'permissions';

insert into public.role_permissions (role_id, permission)
select 'role_organization_owner', unnest(array[
  'organization.manage', 'security.users.view', 'security.users.manage',
  'security.roles.view', 'security.roles.manage', 'production.manage', 'production.delete'
]);

insert into public.role_permissions (role_id, permission)
select 'role_organization_admin', unnest(array[
  'organization.manage', 'security.users.view', 'security.users.manage',
  'security.roles.view', 'security.roles.manage', 'production.manage'
]);

-- Production Super Admin: literally everything (PERMISSION_MATRIX_V1.md §4:
-- "Every permission listed in §2 within their production").
insert into public.role_permissions (role_id, permission)
select 'role_production_super_admin', key from public.permissions;

-- Executive Producer, Producer, Line Producer, UPM: full view/manage across
-- all domains except security.*/permissions.manage; budget.approve and
-- bookings.approve included.
insert into public.role_permissions (role_id, permission)
select r.id, p.key
from public.permissions p
cross join (values ('role_executive_producer'), ('role_producer'), ('role_line_producer'), ('role_upm')) as r(id)
where p.domain not like 'security.%' and p.key not in ('permissions.manage');

-- Production management tier: manage on schedule/callsheet/crew/cast;
-- view (not manage) on budget/contracts; view (not manage) on
-- bookings/travel/accommodation/transport; view on the domains they need
-- day-to-day visibility into but don't own.
insert into public.role_permissions (role_id, permission)
select r.id, p.key
from (values
  ('role_production_manager'), ('role_production_coordinator'), ('role_apoc'), ('role_1st_ad'), ('role_2nd_ad')
) as r(id)
cross join lateral (values
  ('schedule.view'), ('schedule.manage'), ('schedule.publish'),
  ('callsheet.view'), ('callsheet.manage'), ('callsheet.publish'), ('callsheet.distribute'),
  ('crew.view'), ('crew.manage'),
  ('cast.view'), ('cast.manage'),
  ('script.view'), ('breakdown.view'), ('locations.view'), ('documents.view'),
  ('budget.view_summary'), ('budget.view_detail'),
  ('contracts.view'),
  ('bookings.view'), ('travel.view'), ('accommodation.view'), ('transport.view'),
  ('departments.view')
) as p(key);

-- Department Head / Department Coordinator: base view across
-- department-relevant domains ONLY — deliberately does NOT include
-- departments.manage / departments.assign_hod / budget.view_detail here.
--
-- Those three are exactly the permissions PERMISSION_MATRIX_V1.md §4 says
-- are "scoped to their own DepartmentHeadAssignment/DepartmentBudgetScope."
-- role_permissions is looked up the same way regardless of whether the
-- caller reached it via production_members.role_id (production-wide) or
-- department_memberships.role_id (should be per-department) — it is the
-- SAME underlying rows either way, so putting a department-scoped
-- permission here at all would leak it production-wide the moment
-- anyone holding this role is checked without department context. That
-- would be the exact cross-department leak AUTHORIZATION_GAP_ANALYSIS.md
-- §5 exists to close, and is exactly the bug a live-Postgres verification
-- run against this migration caught before this PR was opened (see
-- docs/audits/VRINDAVAN_MIGRATION_IMPACT.md's P1b verification section).
--
-- Instead, packages/auth/src/authorize.ts's evaluateAuthorization() grants
-- departments.manage/departments.assign_hod directly from
-- department_head_assignments — being the recorded HOD of department X is
-- what grants management rights on department X, not holding a role
-- string (LOGISTICS_DOMAIN_MODEL.md §5 calls DepartmentHeadAssignment
-- "the authoritative... record... that the authorization engine actually
-- checks," replacing crew_members.isHod's display-only flag with exactly
-- this). budget.view_detail is granted the same structurally-safe way:
-- via department_permissions (seeded below, one row per department),
-- which evaluateAuthorization() only ever consults for the department
-- actually matching resource.departmentId.
insert into public.role_permissions (role_id, permission)
select r.id, p.key
from (values ('role_department_head'), ('role_department_coordinator')) as r(id)
cross join lateral (values
  ('schedule.view'), ('callsheet.view'), ('crew.view'), ('cast.view'),
  ('locations.view'), ('documents.view'), ('departments.view')
) as p(key);

-- Department Member: view within their department scope only.
insert into public.role_permissions (role_id, permission)
select 'role_department_member', unnest(array[
  'schedule.view', 'callsheet.view', 'crew.view', 'cast.view', 'locations.view', 'departments.view'
]);

insert into public.role_permissions (role_id, permission)
select 'role_production_accountant', unnest(array[
  'budget.view_summary', 'budget.view_detail', 'budget.manage', 'budget.approve',
  'expenses.view', 'expenses.create', 'expenses.approve', 'bookings.approve'
]);

insert into public.role_permissions (role_id, permission)
select 'role_travel_coordinator', unnest(array[
  'travel.view', 'travel.manage', 'travel.approve', 'catering.dietary.view_operational'
]);

insert into public.role_permissions (role_id, permission)
select 'role_transport_coordinator', unnest(array['transport.view', 'transport.manage', 'transport.approve']);

insert into public.role_permissions (role_id, permission)
select 'role_catering_head', unnest(array[
  'catering.manage', 'catering.approve', 'catering.dietary.view_individual',
  'catering.dietary.view_operational', 'catering.counts.view_aggregate'
]);

insert into public.role_permissions (role_id, permission)
select 'role_booking_manager', unnest(array['bookings.view', 'bookings.manage', 'bookings.approve']);

-- External tier: minimal, self-scoped view only. Resource-instance scoping
-- (their own call times/travel/accommodation; the booking(s) naming a
-- vendor) is enforced by authorize()'s resource-match step, not this data.
insert into public.role_permissions (role_id, permission)
select 'role_cast', unnest(array['cast.view', 'travel.view', 'accommodation.view', 'schedule.view', 'callsheet.view']);

insert into public.role_permissions (role_id, permission)
select 'role_background', unnest(array['travel.view', 'accommodation.view', 'schedule.view', 'callsheet.view']);

insert into public.role_permissions (role_id, permission)
select 'role_vendor', unnest(array['bookings.view']);

-- External Viewer: intentionally zero role-bundle permissions — the
-- default-deny floor. Access is granted per-resource only, not by role.

-- Preserved-from-current-app roles (not in PERMISSION_MATRIX_V1.md's tier
-- table — see the roles seed comment above for why these exist).
insert into public.role_permissions (role_id, permission)
select 'role_director', unnest(array[
  'script.view', 'script.manage', 'script.import', 'breakdown.view', 'breakdown.manage',
  'schedule.view', 'cast.view', 'crew.view'
]);

insert into public.role_permissions (role_id, permission)
select 'role_crew', unnest(array['schedule.view', 'callsheet.view', 'crew.view']);

-- ============================================================================
-- production_members — additive columns only (see schema.ts's comments for
-- why `role` text is untouched). Backfill roleId for every existing row by
-- matching the current PRODUCTION_ROLES text values onto the system
-- template roles seeded above — a closed set of exactly 7 known literal
-- values (packages/auth/src/index.ts), not a fuzzy/fragile name match.
-- ============================================================================
alter table public.production_members add column role_id text references public.roles(id) on delete set null;
alter table public.production_members add column status text not null default 'ACTIVE';
alter table public.production_members add column effective_from timestamptz;
alter table public.production_members add column effective_until timestamptz;

update public.production_members set role_id = case role
  when 'Producer' then 'role_producer'
  when 'Director' then 'role_director'
  when '1st AD' then 'role_1st_ad'
  when 'UPM' then 'role_upm'
  when 'Production Accountant' then 'role_production_accountant'
  when 'Department Head' then 'role_department_head'
  when 'Crew' then 'role_crew'
  else null
end;

create index production_members_role_idx on public.production_members (role_id);

-- ============================================================================
-- departments — backfilled from the app's existing STANDARD_DEPARTMENTS
-- list (packages/core/src/index.ts) for every existing production. Safe on
-- an empty productions table (a no-op, same reasoning as 0016's backfill).
-- crew_members.department/isHod are NOT read, touched, or migrated here.
-- ============================================================================
create table public.departments (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  parent_department_id text references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint departments_production_name_unique unique (production_id, name)
);

create index departments_production_idx on public.departments (production_id);

insert into public.departments (id, production_id, name, created_at)
select 'dept_' || p.id || '_' || row_number() over (partition by p.id order by d.ord), p.id, d.name, now()
from public.productions p
cross join lateral (
  values
    ('Production', 1), ('Camera', 2), ('Grip & Electric', 3), ('Sound', 4), ('Art', 5),
    ('Props', 6), ('Wardrobe', 7), ('Hair & Makeup', 8), ('Locations', 9), ('Stunts', 10),
    ('Transportation', 11), ('Logistics', 12), ('Catering', 13), ('Post-Production', 14),
    ('Visual Effects', 15), ('Special Effects', 16), ('Set Decorating', 17), ('Casting', 18),
    ('Construction', 19), ('Medic', 20), ('Accounting', 21), ('Video/Playback', 22),
    ('Animals', 23), ('Publicity', 24), ('Additional Labor', 25)
) as d(name, ord);

-- No separate (production_id, name) index needed: the departments_production_name_unique
-- constraint above already creates one covering both columns.

-- ============================================================================
-- department_memberships / department_head_assignments / department_budget_scopes
-- — created empty, deliberately not backfilled.
--
-- crew_members has no userId/auth-account link (it records cast/crew by
-- name only — see packages/db/src/schema.ts) — there is no reliable way to
-- map an existing crew_members.isHod=true row to a real Supabase Auth user
-- account, so auto-backfilling department_head_assignments from it would
-- mean guessing. Assigning real users to departments/HOD roles is a future
-- data-entry step (a UI this migration does not build), not something safe
-- to infer here.
--
-- department_permissions IS backfilled below (structural, not user data —
-- see the comment above it).
-- ============================================================================
create table public.department_memberships (
  department_id text not null references public.departments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id text references public.roles(id) on delete set null,
  status text not null default 'ACTIVE',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (department_id, user_id)
);

create table public.department_head_assignments (
  department_id text not null references public.departments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (department_id, user_id)
);

create table public.department_permissions (
  department_id text not null references public.departments(id) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (department_id, permission)
);

-- Structural, not user data: every department gets budget.view_detail
-- available to whoever belongs to it (evaluateAuthorization() only ever
-- reads a department's department_permissions when resource.departmentId
-- matches, so this is scoped by construction, unlike a role_permissions
-- row would be — see the role_department_head/role_department_coordinator
-- comment above for why this couldn't safely live there instead).
insert into public.department_permissions (department_id, permission)
select id, 'budget.view_detail' from public.departments;

create table public.department_budget_scopes (
  department_id text not null references public.departments(id) on delete cascade,
  budget_line_id text not null references public.budget_lines(id) on delete cascade,
  primary key (department_id, budget_line_id)
);

create index department_memberships_user_idx on public.department_memberships (user_id);
create index department_head_assignments_user_idx on public.department_head_assignments (user_id);

-- ============================================================================
-- Helper predicates — mirrors is_production_member/is_production_owner
-- exactly (0001_rls_and_auth_trigger.sql, 0016_organization_governance.sql).
-- ============================================================================
create or replace function public.is_department_member(target_department_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.department_memberships dm
    where dm.department_id = target_department_id
      and dm.user_id = auth.uid()
  );
$$;

create or replace function public.is_department_head(target_department_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.department_head_assignments dha
    where dha.department_id = target_department_id
      and dha.user_id = auth.uid()
  );
$$;

grant execute on function public.is_department_member(text) to authenticated;
grant execute on function public.is_department_head(text) to authenticated;

-- ============================================================================
-- RLS — read access follows production/department membership; every new
-- table's write access (insert/update/delete) is left DENIED by default
-- (RLS enabled, no policy for those operations) since no Server Action
-- writes to any of these tables yet in this phase — matching the "default
-- DENY" principle SECURITY_ARCHITECTURE_V1.md §1 establishes, rather than
-- opening a write path with no real feature or authorize() check behind it.
-- ============================================================================
alter table public.permissions enable row level security;
create policy "any authenticated user reads the permission catalog" on public.permissions for select
  to authenticated
  using (true);

alter table public.roles enable row level security;
create policy "read system template roles or own org's custom roles" on public.roles for select
  to authenticated
  using (organization_id is null or public.is_organization_member(organization_id));

alter table public.role_permissions enable row level security;
create policy "read role_permissions for a visible role" on public.role_permissions for select
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and (r.organization_id is null or public.is_organization_member(r.organization_id))
    )
  );

alter table public.departments enable row level security;
create policy "members read departments" on public.departments for select
  to authenticated
  using (public.is_production_member(production_id));

alter table public.department_memberships enable row level security;
create policy "read own or co-department membership rows" on public.department_memberships for select
  to authenticated
  using (user_id = auth.uid() or public.is_department_member(department_id));

alter table public.department_head_assignments enable row level security;
create policy "production members read HOD assignments" on public.department_head_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_head_assignments.department_id
        and public.is_production_member(d.production_id)
    )
  );

alter table public.department_permissions enable row level security;
create policy "production members read department permission grants" on public.department_permissions for select
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_permissions.department_id
        and public.is_production_member(d.production_id)
    )
  );

alter table public.department_budget_scopes enable row level security;
create policy "production members read department budget scopes" on public.department_budget_scopes for select
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_budget_scopes.department_id
        and public.is_production_member(d.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed by this migration:
-- - crew_members.department / crew_members.isHod — untouched (display
--   layer only, per LOGISTICS_DOMAIN_MODEL.md §5's migration note).
-- - production_members.role (text) — every existing Server Action and RLS
--   policy that reads it is completely unaffected.
-- - Every existing table's RLS policy — none are modified.
-- - No Server Action anywhere in apps/web calls authorize() or reads any
--   table created by this migration. Wiring that up is separate, future,
--   explicitly-authorized work.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0017_authorization_foundation.sql
-- ============================================================================

-- ============================================================================
-- BEGIN packages/db/migrations/0018_booking_approval_engine.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P5 — Booking + Approval Engine. See docs/audits/LOGISTICS_DOMAIN_MODEL.md
-- §0.1-0.3 and docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4-5 for
-- the full design and the reasoning behind building this before any
-- Logistics subdomain (Travel, Accommodation, Transportation, Catering —
-- none of which exist as schema yet).
--
-- Scope, deliberately: schema only. Nothing in this migration changes any
-- existing screen, Server Action, or table's behavior. No Server Action
-- anywhere in apps/web reads or writes any table created here — that is
-- separate, future, explicitly-authorized work, exactly like P1b's
-- authorization foundation was before its own wiring plan.
-- ============================================================================

-- ============================================================================
-- bookings — the shared substrate every Logistics subdomain attaches to via
-- subject_type/subject_id rather than each reimplementing its own
-- lifecycle. Both columns stay null until the first subdomain lands.
-- ============================================================================
create table public.bookings (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  type text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  department_id text references public.departments(id) on delete set null,
  subject_type text,
  subject_id text,
  vendor_ref text,
  cost numeric(12, 2),
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_production_idx on public.bookings (production_id);
create index bookings_department_idx on public.bookings (department_id);

create table public.booking_quotes (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  vendor_ref text not null,
  cost numeric(12, 2) not null,
  currency text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index booking_quotes_booking_idx on public.booking_quotes (booking_id);

create table public.booking_confirmations (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  confirmation_ref text not null,
  confirmed_at timestamptz not null default now()
);
create index booking_confirmations_booking_idx on public.booking_confirmations (booking_id);

create table public.booking_changes (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  change_type text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index booking_changes_booking_idx on public.booking_changes (booking_id);

create table public.booking_cancellations (
  booking_id text primary key references public.bookings(id) on delete cascade,
  reason text not null,
  refund_state text,
  cancelled_at timestamptz not null default now()
);

-- ============================================================================
-- Approval Engine — no module gets a hard-coded approval `if` chain; a new
-- booking type reuses this with a different stage list, not new code.
-- ============================================================================
create table public.approval_workflows (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index approval_workflows_production_idx on public.approval_workflows (production_id);

create table public.approval_stages (
  id text primary key,
  workflow_id text not null references public.approval_workflows(id) on delete cascade,
  "order" integer not null,
  required_permission text not null references public.permissions(key) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workflow_id, "order")
);
create index approval_stages_workflow_idx on public.approval_stages (workflow_id);

create table public.approval_rules (
  id text primary key,
  stage_id text not null references public.approval_stages(id) on delete cascade,
  condition_type text not null,
  condition_value text not null
);
create index approval_rules_stage_idx on public.approval_rules (stage_id);

create table public.approval_requests (
  id text primary key,
  workflow_id text not null references public.approval_workflows(id) on delete restrict,
  booking_id text not null references public.bookings(id) on delete cascade,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index approval_requests_booking_idx on public.approval_requests (booking_id);
create index approval_requests_workflow_idx on public.approval_requests (workflow_id);

-- Doubles as LOGISTICS_DOMAIN_MODEL.md §0.1's BookingApproval: a booking's
-- approval history is its approval_requests joined to their
-- approval_decisions, not a separate, duplicate record.
create table public.approval_decisions (
  id text primary key,
  request_id text not null references public.approval_requests(id) on delete cascade,
  stage_id text not null references public.approval_stages(id) on delete restrict,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decision text not null,
  note text,
  decided_at timestamptz not null default now()
);
create index approval_decisions_request_idx on public.approval_decisions (request_id);

-- ============================================================================
-- Logistics ↔ Finance (§0.3): Booking → Commitment → Invoice → Actual.
-- `expenses.booking_id` (added below) is the Actual stage — today's real
-- table, not a new one, per the domain model's explicit "no vendor/cost
-- data duplicated between Money and Logistics" requirement.
-- ============================================================================
create table public.commitments (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null,
  budget_line_id text references public.budget_lines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index commitments_booking_idx on public.commitments (booking_id);
create index commitments_budget_line_idx on public.commitments (budget_line_id);

create table public.invoices (
  id text primary key,
  commitment_id text not null references public.commitments(id) on delete cascade,
  vendor_ref text not null,
  amount numeric(12, 2) not null,
  invoice_number text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index invoices_commitment_idx on public.invoices (commitment_id);

alter table public.expenses add column booking_id text references public.bookings(id) on delete set null;

-- ============================================================================
-- RLS — same posture as P1b (0017_authorization_foundation.sql): read
-- access follows production membership; every table's write access
-- (insert/update/delete) is left DENIED by default (RLS enabled, no
-- policy for those operations), since no Server Action writes to any of
-- these tables yet.
-- ============================================================================
alter table public.bookings enable row level security;
create policy "production members read bookings" on public.bookings for select
  to authenticated
  using (public.is_production_member(production_id));

alter table public.booking_quotes enable row level security;
create policy "production members read booking quotes" on public.booking_quotes for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_quotes.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_confirmations enable row level security;
create policy "production members read booking confirmations" on public.booking_confirmations for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_confirmations.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_changes enable row level security;
create policy "production members read booking changes" on public.booking_changes for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_changes.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_cancellations enable row level security;
create policy "production members read booking cancellations" on public.booking_cancellations for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_cancellations.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.approval_workflows enable row level security;
create policy "production members read approval workflows" on public.approval_workflows for select
  to authenticated
  using (public.is_production_member(production_id));

alter table public.approval_stages enable row level security;
create policy "production members read approval stages" on public.approval_stages for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_workflows w
      where w.id = approval_stages.workflow_id
        and public.is_production_member(w.production_id)
    )
  );

alter table public.approval_rules enable row level security;
create policy "production members read approval rules" on public.approval_rules for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_stages s
      join public.approval_workflows w on w.id = s.workflow_id
      where s.id = approval_rules.stage_id
        and public.is_production_member(w.production_id)
    )
  );

alter table public.approval_requests enable row level security;
create policy "production members read approval requests" on public.approval_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = approval_requests.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.approval_decisions enable row level security;
create policy "production members read approval decisions" on public.approval_decisions for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      join public.bookings b on b.id = r.booking_id
      where r.id = approval_decisions.request_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.commitments enable row level security;
create policy "production members read commitments" on public.commitments for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = commitments.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.invoices enable row level security;
create policy "production members read invoices" on public.invoices for select
  to authenticated
  using (
    exists (
      select 1 from public.commitments c
      join public.bookings b on b.id = c.booking_id
      where c.id = invoices.commitment_id
        and public.is_production_member(b.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed by this migration:
-- - No Logistics subdomain table (Travel/Accommodation/Transportation/
--   Catering) is created — still design-only per LOGISTICS_DOMAIN_MODEL.md
--   §1-3,6. bookings.subject_type/subject_id have nothing to point at yet.
-- - Every existing table's RLS policy, including expenses' — none are
--   modified. The new expenses.booking_id column is nullable and
--   unindexed-by-default-query-path, so existing Money queries are
--   unaffected.
-- - No Server Action anywhere in apps/web reads or writes any table
--   created by this migration.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0018_booking_approval_engine.sql
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
  v_others_diff_count int;
  v_creator_count int;
  v_membership_count int;
  v_missing_membership_count int;
  v_permissions_count int;
  v_roles_count int;
  v_missing_roleid_count int;
  v_departments_count int;
  v_expected_departments_count int;
  v_productions_count int;
  v_bookings_count int;
  v_approval_workflows_count int;
  v_commitments_count int;
  v_invoices_count int;
  v_expenses_with_booking_count int;
begin
  -- ===== 0016 invariants =====
  select id, created_by, created_at into v_before_id, v_before_created_by, v_before_created_at from _cutover_before_production;
  select id, created_by, created_at, organization_id into v_after_id, v_after_created_by, v_after_created_at, v_after_org_id
    from public.productions where id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6';

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

  select count(*) into v_vrindavan_count_after from public.productions where name = 'Vrindavan Mein param Aanand';
  if v_vrindavan_count_after != 2 then
    raise exception 'INVARIANT FAILED (0016): expected exactly 2 ''Vrindavan Mein param Aanand'' rows after migration (the authoritative one plus the known older duplicate), found %', v_vrindavan_count_after;
  end if;

  select o.name into v_org_name from public.organizations o where o.id = v_after_org_id;
  if v_org_name is distinct from 'GSK Productions Inc.' then
    raise exception 'INVARIANT FAILED (0016): organization name is ''%'', expected ''GSK Productions Inc.''', v_org_name;
  end if;

  select count(*) into v_missing_org_count from public.productions where organization_id is null;
  if v_missing_org_count != 0 then
    raise exception 'INVARIANT FAILED (0016): % production(s) still missing organization_id', v_missing_org_count;
  end if;

  select count(*) into v_others_diff_count from (
    select p.id from public.productions p
    join _cutover_before_others b on b.id = p.id
    where p.name is distinct from b.name
       or p.created_by is distinct from b.created_by
       or p.created_at is distinct from b.created_at
  ) x;
  if v_others_diff_count != 0 then
    raise exception 'INVARIANT FAILED (0016): % of the two known non-authoritative productions (THE BAND, the older Vrindavan duplicate) changed identity beyond organization_id', v_others_diff_count;
  end if;

  select count(*) into v_creator_count from (select distinct created_by from public.productions) x;
  select count(*) into v_membership_count from public.organization_memberships where organization_id = v_after_org_id;
  select count(*) into v_missing_membership_count from (
    select distinct p.created_by from public.productions p
    where not exists (
      select 1 from public.organization_memberships om
      where om.organization_id = v_after_org_id and om.user_id = p.created_by
    )
  ) x;
  if v_missing_membership_count != 0 then
    raise exception 'INVARIANT FAILED (0016): % distinct production creator(s) are not organization_memberships rows for %', v_missing_membership_count, v_after_org_id;
  end if;
  if v_membership_count != v_creator_count then
    raise exception 'INVARIANT FAILED (0016): expected % organization_memberships rows (one per distinct production creator), found %', v_creator_count, v_membership_count;
  end if;

  select count(*) into v_before_members_count from _cutover_before_members;
  select count(*) into v_after_members_count from public.production_members
    where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6';
  if v_before_members_count != v_after_members_count then
    raise exception 'INVARIANT FAILED (0016): production_members row count changed (% -> %)', v_before_members_count, v_after_members_count;
  end if;

  select count(*) into v_members_diff_count from (
    (select production_id, user_id, role from _cutover_before_members
     except
     select production_id, user_id, role from public.production_members
       where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    union all
    (select production_id, user_id, role from public.production_members
       where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6'
     except
     select production_id, user_id, role from _cutover_before_members)
  ) x;
  if v_members_diff_count != 0 then
    raise exception 'INVARIANT FAILED (0016): production_members rows differ from baseline (% mismatched row(s))', v_members_diff_count;
  end if;

  select
    b.scenes = (select count(*) from public.scenes where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.characters = (select count(*) from public.characters where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.cast_members = (select count(*) from public.cast_members where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.crew_members = (select count(*) from public.crew_members where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.shoot_days = (select count(*) from public.shoot_days where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.script_pages = (select count(*) from public.script_pages where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.breakdown_elements = (select count(*) from public.breakdown_elements where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.call_sheets = (select count(*) from public.call_sheets where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.documents = (select count(*) from public.documents where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
    and b.expenses = (select count(*) from public.expenses where production_id = 'a5d6802a-b40c-475e-8336-eda13cdc3bf6')
  into v_counts_match
  from _cutover_before_counts b;

  if not v_counts_match then
    raise exception 'INVARIANT FAILED (0016/0017/0018): one or more content-table counts changed for the authoritative Vrindavan production';
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

  -- ===== 0018 invariants =====
  -- Purely additive: every new table must exist and be empty (proves this
  -- run added no stray data), and expenses' new booking_id column must be
  -- null for every existing row (this migration links nothing itself —
  -- only a later, separate feature would ever populate it).
  select count(*) into v_bookings_count from public.bookings;
  if v_bookings_count != 0 then
    raise exception 'INVARIANT FAILED (0018): expected 0 bookings immediately after migration, found %', v_bookings_count;
  end if;

  select count(*) into v_approval_workflows_count from public.approval_workflows;
  if v_approval_workflows_count != 0 then
    raise exception 'INVARIANT FAILED (0018): expected 0 approval_workflows immediately after migration, found %', v_approval_workflows_count;
  end if;

  select count(*) into v_commitments_count from public.commitments;
  if v_commitments_count != 0 then
    raise exception 'INVARIANT FAILED (0018): expected 0 commitments immediately after migration, found %', v_commitments_count;
  end if;

  select count(*) into v_invoices_count from public.invoices;
  if v_invoices_count != 0 then
    raise exception 'INVARIANT FAILED (0018): expected 0 invoices immediately after migration, found %', v_invoices_count;
  end if;

  select count(*) into v_expenses_with_booking_count from public.expenses where booking_id is not null;
  if v_expenses_with_booking_count != 0 then
    raise exception 'INVARIANT FAILED (0018): expected 0 expenses with a non-null booking_id immediately after migration, found %', v_expenses_with_booking_count;
  end if;

  raise notice 'ALL CUTOVER INVARIANTS PASSED (0016 + 0017 + 0018) for Vrindavan Mein param Aanand (a5d6802a-b40c-475e-8336-eda13cdc3bf6) — safe to commit.';
end $$;

commit;
```

**If this reaches `commit;` and prints the success notice, every invariant above held.** If any check fails, Postgres has already rolled back the entire transaction — both migrations' DDL/DML included — before the error reaches you; nothing is left half-applied. As with each individual migration's own atomic script, `rollback;` (in place of `commit;`) is always available if a manual review after the notice still looks wrong before you commit.

## Vrindavan invariant checks (summary — full detail above)

- Authoritative Vrindavan production (`a5d6802a-b40c-475e-8336-eda13cdc3bf6`) `id`, `created_by`, `created_at` byte-identical before/after.
- Exactly two productions named "Vrindavan Mein param Aanand" (lowercase p) — the authoritative one plus the known older duplicate — before and after (no *new* duplicate created).
- `THE BAND` and the older Vrindavan duplicate byte-identical before/after except for gaining `organization_id`.
- `production_members` rows for the authoritative Vrindavan production byte-identical before/after (both directions — additions and removals both caught).
- Every content-table count (scenes, characters, cast_members, crew_members, shoot_days, script_pages, breakdown_elements, call_sheets, documents) unchanged for the authoritative production.
- `organization_id` populated on every production, organization named exactly "GSK Productions Inc."
- Every distinct production creator (2, as reviewed) is an Owner member of that one organization.
- Every `production_members` row with a recognized role text has a non-null `role_id`.
- Department count matches `productions_count × 25` exactly.
- Permission/role catalog counts match their expected seed sizes (71 / 27).
- Every new booking/approval/finance table (`bookings`, `approval_workflows`, `commitments`, `invoices`, ...) is empty immediately after migration — proves the cutover added no stray data.
- `expenses.booking_id` is null for every row immediately after migration — this migration only adds the column, it never populates it.

## Combined rollback

Reverse migration order (undo 0018 first, then 0017, then 0016) — matches how the three migrations were applied. Verified against a populated test database: restores `production_members` and every existing table to their exact pre-0016 shape.

```sql
begin;

-- ===== Undo 0018 =====
drop policy if exists "production members read invoices" on public.invoices;
drop policy if exists "production members read commitments" on public.commitments;
drop policy if exists "production members read approval decisions" on public.approval_decisions;
drop policy if exists "production members read approval requests" on public.approval_requests;
drop policy if exists "production members read approval rules" on public.approval_rules;
drop policy if exists "production members read approval stages" on public.approval_stages;
drop policy if exists "production members read approval workflows" on public.approval_workflows;
drop policy if exists "production members read booking cancellations" on public.booking_cancellations;
drop policy if exists "production members read booking changes" on public.booking_changes;
drop policy if exists "production members read booking confirmations" on public.booking_confirmations;
drop policy if exists "production members read booking quotes" on public.booking_quotes;
drop policy if exists "production members read bookings" on public.bookings;

alter table public.expenses drop column if exists booking_id;

drop table if exists public.invoices;
drop table if exists public.commitments;
drop table if exists public.approval_decisions;
drop table if exists public.approval_requests;
drop table if exists public.approval_rules;
drop table if exists public.approval_stages;
drop table if exists public.approval_workflows;
drop table if exists public.booking_cancellations;
drop table if exists public.booking_changes;
drop table if exists public.booking_confirmations;
drop table if exists public.booking_quotes;
drop table if exists public.bookings;

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
4. **Retarget and merge PR #26** (P1c — wiring plan + shadow adapter, no schema) from base `claude/p1b-authorization-foundation` to `main`, same process.
5. **Retarget and merge PR #27** (P2 — Department UX spec, docs only) from base `claude/p1c-authorization-wiring-plan` to `main`.
6. **Retarget and merge PR #28** (P3 — Security Center UX spec, docs only) from base `claude/p2-department-ux-spec` to `main`.
7. **Retarget and merge PR #29** (P4 — Logistics Implementation Readiness, docs only) from base `claude/p3-security-center-ux-spec` to `main`.
8. **Retarget and merge the P5 PR** (Booking + Approval Engine schema) from base `claude/p4-logistics-readiness` to `main`.
9. Any further stacked PRs, in the same retarget-and-merge sequence, in the order they were built.

## CI order

CI (`.github/workflows/ci.yml`) only runs automatically on PRs targeting `main` and on pushes to `main` — it does **not** run on these stacked PRs today, since each targets the previous stacked branch, not `main` (confirmed directly: PR #25 and PR #26 show zero CI check runs, only the Vercel preview check). This means:

- Every stacked PR must be **locally verified** (lint/typecheck/test/build, exactly as documented in each PR's own description) before merge — that verification already exists for every PR opened so far.
- CI only becomes real for a given PR the moment it's retargeted to `main` (step 3/4 above) — expect a fresh CI run at that point, and treat it as required before that specific merge, same as any other PR into `main`.
- The live Supabase cutover (step 1) happens **before** any retargeting — the app's code isn't merged to `main` (and thus isn't deployed) until the database it depends on already has the schema, avoiding exactly the "deployed code expects tables that don't exist yet" failure mode the owner flagged.

## Smoke-test checklist (after cutover + merges, before declaring done)

1. Login with an existing account — normal sign-in flow works.
2. Load the Vrindavan Mein param Aanand (authoritative, `a5d6802a-b40c-475e-8336-eda13cdc3bf6`) dashboard/overview — data renders, nothing errors.
3. Logout, then log back in immediately — no redirect loop, no stale session issue.
4. Load a protected page requiring production membership (e.g. `/schedule`, `/cast`) — loads normally.
5. Owner/admin (Producer role) access — can still reach Settings, Team management, budget pages exactly as before.
6. A non-Producer member's access — unaffected (still governed entirely by the unchanged `production_members.role`/RLS, per P1a/P1b's explicit "nothing wired in" scope).
7. Create a brand-new test production (not Vrindavan) — confirms `production-actions.ts`'s organization find-or-create logic (P1a) works live, not just locally.
8. Confirm no console errors/500s on any of the above.

## What must be verified before deployment

- [ ] Combined atomic script committed successfully against live Supabase, invariants confirmed via its own output plus the owner's independent spot-check queries (`VRINDAVAN_MIGRATION_IMPACT.md`'s Owner Runbook queries, run against the real Vrindavan row).
- [x] Live production identity confirmed by a real, read-only pre-flight check before this revision was written — three productions (`THE BAND`, and two rows named `Vrindavan Mein param Aanand`), two distinct creators (`gskcreatives@gmail.com`, `gskproductionsinc@gmail.com`). The combined script's own pre-flight now hard-aborts unless live data still matches this exact reviewed state, by id — a human review first (as originally planned here) is no longer the only guard against drift; the script itself now re-verifies it every run.
- [ ] All stacked PRs' local verification (lint/typecheck/test/build) re-run one final time on each branch immediately before its retarget-and-merge step, not relied on from when it was originally opened.
- [ ] Smoke-test checklist above completed on the live deployed app after the final merge.
- [ ] No `assertRole()`/`authorize()` behavior has changed anywhere — P1a/P1b/P1c/P5 are additive-only; this is a structural property of the code (verifiable by re-reading the diffs), not something that needs separate live testing, but worth confirming nothing drifted between when each PR was written and when it's actually deployed.
- [ ] No Server Action reads or writes any table P5 (0018) adds — also structurally verifiable by re-reading the diff, same as above.
