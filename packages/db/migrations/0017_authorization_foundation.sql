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
