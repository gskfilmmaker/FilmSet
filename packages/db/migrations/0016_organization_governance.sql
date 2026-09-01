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
-- apps/web/components/shell.tsx's BrandFooter), owned by whichever user
-- created the earliest-existing production row, and backfills every
-- existing production into it regardless of which user technically holds
-- created_by on that individual row. This is correct for the current
-- single-owner state of the app (one company producing possibly multiple
-- productions under one account) and is safe even if productions has zero
-- rows (a fresh database, e.g. local dev or CI) — every statement below is
-- then a no-op with no rows to act on, and the final NOT NULL constraint
-- still applies cleanly since no row would violate it.
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
select o.id, o.created_by, 'Owner', now()
from public.organizations o;

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
