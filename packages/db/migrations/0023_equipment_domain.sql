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
  constraint equipment_catalog_items_department_valid check (department in ('Camera', 'Grip & Electric', 'Sound'))
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
  constraint equipment_bookings_quantity_positive check (quantity > 0)
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
