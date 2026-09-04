-- ============================================================================
-- FilmSet -- P14 Cutover Script (0023)
-- Generated to accompany the Equipment domain PR (claude/p14-equipment-domain).
-- Applies migration 0023_equipment_domain.sql against live Supabase.
--
-- Purely additive, same posture as the P10/P11/P12 cutovers: no existing
-- data is read, changed, or deleted. New, empty tables plus RLS
-- policies only. The pre-flight below confirms the prerequisite
-- migrations (through 0022) are already live, and that this script
-- hasn't already been run, before touching anything.
--
-- If this reaches commit; and prints the success notice, every
-- invariant held. If ANY check fails, Postgres has already rolled back
-- the entire transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'catering_vendors') then
    raise exception 'PRE-FLIGHT ABORT: public.catering_vendors not found -- migration 0022 does not appear to be live yet. This script depends on 0016-0022 already being applied.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    raise exception 'PRE-FLIGHT ABORT: public.bookings not found -- migration 0018 does not appear to be live yet.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'department_head_assignments') then
    raise exception 'PRE-FLIGHT ABORT: public.department_head_assignments not found -- migration 0017 does not appear to be live yet (the Equipment domain''s DOP sign-off checks the real Camera department HOD record, so it must already exist).';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'equipment_vendors') then
    raise exception 'PRE-FLIGHT ABORT: public.equipment_vendors already exists -- migration 0023 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: 0016-0022 are live, 0023 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0023_equipment_domain.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P14 -- Equipment domain. Fourth real Logistics subdomain built on the
-- Booking Engine (0018), covering the three departments the owner asked
-- for: Camera, Grip & Electric, Sound (packages/core's STANDARD_DEPARTMENTS
-- names, reused verbatim as this migration's `department` check values so
-- a catalog item's department always matches a real crew department name).
--
-- The point of this domain (per the owner's own framing): know what
-- equipment is booked, at what price, in what quantity, for which shoot
-- day, so equipment spend and usage can actually be optimized (drop a
-- Steadicam from a day that doesn't need it) instead of guessed at.
--
-- Two distinct concerns, two tables:
-- - equipment_catalog_items: a vendor's approved-for-this-production
--   equipment list (name, department, category, a reference daily rate) --
--   DOP-approved once, reused across many bookings. "DOP" here means
--   whoever `department_head_assignments` (0017) names as the Camera
--   department's head for this production -- there is no dedicated "DOP"
--   PRODUCTION_ROLES value (packages/auth/src/index.ts only has Producer/
--   Director/1st AD/UPM/Production Accountant/Department Head/Crew), so
--   the Server Action layer checks the real Camera-HOD record instead of
--   inventing a role the rest of the app doesn't have. A production that
--   hasn't set up a Camera department + HOD yet (Settings > Departments)
--   simply can't record a DOP approval until it does -- an honest gap,
--   not silently allowed to anyone.
-- - equipment_bookings: one line item, one shoot day, one catalog item,
--   a quantity and a rate snapshot (may differ from the catalog's
--   reference rate -- a real negotiated price), the Booking (0018)
--   subtype (subjectType "EQUIPMENT_BOOKING"), and the owner's requested
--   three-role sign-off: dop_approved / director_approved / producer_approved,
--   each an independent boolean + who + when, not a single shared status.
--   Director gates on the real "Director" PRODUCTION_ROLES value; Producer
--   on "Producer"; DOP on the same Camera-HOD check as catalog approval.
--
-- Deliberately NOT built (documented, not silently dropped): per-item
-- serial/asset tracking (a catalog item is "2x Steadicam rig", not two
-- individually tracked serialized units), damage/insurance claims, and
-- wiring the generic approval_workflows/approval_requests engine (0018) --
-- every subdomain in this migration train uses a simple, direct gate
-- instead of that generic engine, and this one follows the same
-- precedent for the same reason (the engine stays unwired everywhere).
-- ============================================================================

-- ============================================================================
-- equipment_vendors -- the production equipment rental house. Same shape
-- as catering_vendors (0022).
-- ============================================================================
create table public.equipment_vendors (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  contact text,
  contract_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_vendors_production_idx on public.equipment_vendors (production_id);

-- ============================================================================
-- equipment_catalog_items -- a vendor's approved equipment list.
-- currency is a real, explicit choice among the five the owner named
-- (USD/INR/CAD/EUR/AED) -- not hard-coded to one, and not a free-text
-- field either, so an Indian supplier's INR quote and a US vendor's USD
-- quote sit side by side on the same production without silently
-- picking a currency for either. Nullable: a line item can exist before
-- its currency is known (e.g. before a quote comes in).
-- ============================================================================
create table public.equipment_catalog_items (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  vendor_id text not null references public.equipment_vendors(id) on delete cascade,
  department text not null,
  category text,
  name text not null,
  daily_rate numeric(12, 2),
  currency text,
  dop_approved boolean not null default false,
  dop_approved_by uuid references public.profiles(id) on delete set null,
  dop_approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_catalog_items_department_valid check (department in ('Camera', 'Grip & Electric', 'Sound')),
  constraint equipment_catalog_items_currency_valid check (currency is null or currency in ('USD', 'INR', 'CAD', 'EUR', 'AED'))
);
create index equipment_catalog_items_production_idx on public.equipment_catalog_items (production_id);
create index equipment_catalog_items_vendor_idx on public.equipment_catalog_items (vendor_id);

-- ============================================================================
-- equipment_bookings -- one line item on one shoot day. The Booking
-- (0018) subtype: booking_id points back at the bookings row whose
-- subjectType is "EQUIPMENT_BOOKING", mirroring stays/movements/
-- catering_orders exactly.
-- ============================================================================
create table public.equipment_bookings (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  catalog_item_id text not null references public.equipment_catalog_items(id) on delete restrict,
  quantity integer not null default 1,
  rate numeric(12, 2),
  currency text,
  booking_id text references public.bookings(id) on delete set null,
  dop_approved boolean not null default false,
  dop_approved_by uuid references public.profiles(id) on delete set null,
  dop_approved_at timestamptz,
  director_approved boolean not null default false,
  director_approved_by uuid references public.profiles(id) on delete set null,
  director_approved_at timestamptz,
  producer_approved boolean not null default false,
  producer_approved_by uuid references public.profiles(id) on delete set null,
  producer_approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_bookings_quantity_positive check (quantity > 0),
  constraint equipment_bookings_currency_valid check (currency is null or currency in ('USD', 'INR', 'CAD', 'EUR', 'AED'))
);
create index equipment_bookings_production_idx on public.equipment_bookings (production_id);
create index equipment_bookings_shoot_day_idx on public.equipment_bookings (shoot_day_id);
create index equipment_bookings_catalog_item_idx on public.equipment_bookings (catalog_item_id);
create index equipment_bookings_booking_idx on public.equipment_bookings (booking_id);

-- ============================================================================
-- RLS -- full read+write, membership-scoped, matching 0020/0021/0022's
-- established posture. All three tables carry production_id directly, so
-- (unlike catering's join-through-meal_services) no exists() join is
-- needed here.
-- ============================================================================
alter table public.equipment_vendors enable row level security;
create policy "members access equipment_vendors" on public.equipment_vendors for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.equipment_catalog_items enable row level security;
create policy "members access equipment_catalog_items" on public.equipment_catalog_items for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.equipment_bookings enable row level security;
create policy "members access equipment_bookings" on public.equipment_bookings for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

-- ============================================================================
-- bookings write RLS already exists (0020 added it for Accommodation) --
-- Equipment reuses the same INSERT/UPDATE policies on `bookings` and the
-- same INSERT policy on `booking_cancellations`, scoped identically by
-- production_id. Nothing to add here.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0023_equipment_domain.sql
-- ============================================================================

do $postcheck$
declare
  v_new_tables int;
  v_row_count int;
  v_write_policy_tables int;
begin
  select count(*) into v_new_tables
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('equipment_vendors', 'equipment_catalog_items', 'equipment_bookings');
  if v_new_tables <> 3 then
    raise exception 'INVARIANT FAILED: expected 3 new equipment tables, found %', v_new_tables;
  end if;

  select
    (select count(*) from public.equipment_vendors)
    + (select count(*) from public.equipment_catalog_items)
    + (select count(*) from public.equipment_bookings)
  into v_row_count;
  if v_row_count <> 0 then
    raise exception 'INVARIANT FAILED: all three new equipment tables should be empty immediately after this migration, found % total rows across them', v_row_count;
  end if;

  select count(distinct tablename) into v_write_policy_tables
  from pg_policies
  where schemaname = 'public'
    and tablename in ('equipment_vendors', 'equipment_catalog_items', 'equipment_bookings')
    and cmd = 'ALL';
  if v_write_policy_tables <> 3 then
    raise exception 'INVARIANT FAILED: expected all 3 new tables to have a FOR ALL policy, found % with one', v_write_policy_tables;
  end if;

  raise notice 'ALL P14 CUTOVER INVARIANTS PASSED (0023) -- safe to commit.';
end $postcheck$;

commit;
