-- ============================================================================
-- P15 -- Catering domain, phase 2: menu catalog + food/beverage preferences
-- + service-standard (packaging/timing/hospitality) fields, per the owner's
-- explicit ask for "vendor list, menu list, each cast and crew preferences
-- like vegetarian/non-vegetarian or food preferences and beverage
-- preferences, and any other detail as per the best international
-- catering standards -- packaging, timing, hospitality like a five star
-- catering service would do."
--
-- Builds on 0022_catering_domain.sql. Vendor list already existed
-- (catering_vendors) -- this migration adds the three things that didn't:
--
-- 1. menu_items -- a production's approved menu catalog, same shape/role
--    as equipment_catalog_items (0023): one row per dish/item, optionally
--    linked to a vendor, with diet type / cuisine / spice level /
--    packaging so a five-star-standard menu can be built and filtered.
-- 2. catering_order_items -- join table so a catering_orders row (already
--    the Booking (0018) subtype) can itemize which menu_items (and how
--    many) were actually ordered, instead of only naming a vendor.
-- 3. dietary_profiles gains real food/beverage PREFERENCE columns
--    (diet_type, beverage_preference, spice_preference) alongside the
--    existing allergy/requirement severity system (dietary_requirements,
--    unchanged) -- "vegetarian" is a standing preference, not a graded
--    allergy severity, so it doesn't belong in dietary_requirements.
-- 4. meal_services gains hospitality/service-standard columns
--    (service_style, packaging_type, service_time, headcount_confirmed,
--    hospitality_notes) so a service can record how it's actually run,
--    not just when/where.
--
-- Same posture as 0022/0023 throughout: full read+write RLS,
-- membership-scoped (public.is_production_member), no authorize() wiring.
-- ============================================================================

-- ============================================================================
-- menu_items -- a production's approved menu catalog.
-- ============================================================================
create table public.menu_items (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  vendor_id text references public.catering_vendors(id) on delete set null,
  name text not null,
  -- STARTER | MAIN | DESSERT | BEVERAGE | SNACK | BREAD | SIDE
  category text,
  cuisine text,
  -- VEGETARIAN | NON_VEGETARIAN | VEGAN | EGGETARIAN | JAIN
  diet_type text,
  -- MILD | MEDIUM | HOT
  spice_level text,
  -- DISPOSABLE_ECO | DISPOSABLE_STANDARD | REUSABLE | PLATED
  packaging_type text,
  price numeric(12, 2),
  -- USD | INR | CAD | EUR | AED -- same explicit list as equipment_catalog_items (0023).
  currency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_category_valid check (category is null or category in ('STARTER', 'MAIN', 'DESSERT', 'BEVERAGE', 'SNACK', 'BREAD', 'SIDE')),
  constraint menu_items_diet_type_valid check (diet_type is null or diet_type in ('VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'JAIN')),
  constraint menu_items_spice_level_valid check (spice_level is null or spice_level in ('MILD', 'MEDIUM', 'HOT')),
  constraint menu_items_packaging_type_valid check (packaging_type is null or packaging_type in ('DISPOSABLE_ECO', 'DISPOSABLE_STANDARD', 'REUSABLE', 'PLATED')),
  constraint menu_items_currency_valid check (currency is null or currency in ('USD', 'INR', 'CAD', 'EUR', 'AED')),
  constraint menu_items_price_non_negative check (price is null or price >= 0)
);
create index menu_items_production_idx on public.menu_items (production_id);
create index menu_items_vendor_idx on public.menu_items (vendor_id);

-- ============================================================================
-- catering_order_items -- itemizes a catering_orders row against the menu
-- catalog. A catering order can still exist with zero items (vendor-only,
-- details TBD) -- this is an addition, not a requirement.
-- ============================================================================
create table public.catering_order_items (
  id text primary key,
  order_id text not null references public.catering_orders(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id) on delete restrict,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint catering_order_items_quantity_positive check (quantity > 0)
);
create index catering_order_items_order_idx on public.catering_order_items (order_id);
create index catering_order_items_menu_item_idx on public.catering_order_items (menu_item_id);

-- ============================================================================
-- dietary_profiles -- add standing food/beverage preference columns,
-- distinct from dietary_requirements' graded allergy severities.
-- ============================================================================
alter table public.dietary_profiles add column diet_type text;
alter table public.dietary_profiles add constraint dietary_profiles_diet_type_valid
  check (diet_type is null or diet_type in ('VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'JAIN', 'HALAL', 'KOSHER'));
alter table public.dietary_profiles add column beverage_preference text;
alter table public.dietary_profiles add column spice_preference text;
alter table public.dietary_profiles add constraint dietary_profiles_spice_preference_valid
  check (spice_preference is null or spice_preference in ('MILD', 'MEDIUM', 'HOT'));

-- ============================================================================
-- meal_services -- add hospitality / service-standard columns.
-- ============================================================================
alter table public.meal_services add column service_style text;
alter table public.meal_services add constraint meal_services_service_style_valid
  check (service_style is null or service_style in ('BUFFET', 'PLATED', 'PACKED_BOXES', 'FAMILY_STYLE'));
alter table public.meal_services add column packaging_type text;
alter table public.meal_services add constraint meal_services_packaging_type_valid
  check (packaging_type is null or packaging_type in ('DISPOSABLE_ECO', 'DISPOSABLE_STANDARD', 'REUSABLE', 'PLATED'));
-- Free-text clock time (e.g. "12:30 PM") -- `date` already carries the day; this is when service actually happens that day.
alter table public.meal_services add column service_time text;
alter table public.meal_services add column headcount_confirmed integer;
alter table public.meal_services add constraint meal_services_headcount_non_negative check (headcount_confirmed is null or headcount_confirmed >= 0);
alter table public.meal_services add column hospitality_notes text;

-- ============================================================================
-- RLS -- full read+write, membership-scoped, matching every table in this
-- domain since 0022.
-- ============================================================================
alter table public.menu_items enable row level security;
create policy "members access menu_items" on public.menu_items for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.catering_order_items enable row level security;
create policy "members access catering_order_items" on public.catering_order_items for all
  to authenticated
  using (
    exists (
      select 1 from public.catering_orders o
      join public.meal_services s on s.id = o.service_id
      where o.id = catering_order_items.order_id
        and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.catering_orders o
      join public.meal_services s on s.id = o.service_id
      where o.id = catering_order_items.order_id
        and public.is_production_member(s.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed by this migration:
-- - dietary_profiles/dietary_requirements RLS policies -- unchanged, the
--   new preference columns are covered by the existing table-level policy.
-- - meal_services RLS policy -- unchanged, same reasoning.
-- - No RLS policy checks catering.dietary.view_individual/etc -- same
--   interim app-layer gate as 0022 (Producer-only via
--   requireProductionMember), not authorize(), which stays unwired.
-- ============================================================================
