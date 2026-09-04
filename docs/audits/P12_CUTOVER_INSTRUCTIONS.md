# Instructions — FilmSet P12 Live Supabase Cutover (0022)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is

Same shape as the P10/P11 cutovers: **purely additive, touches no existing data.** It creates six brand-new, empty tables for a new Catering feature (dietary profiles, dietary requirements, catering vendors, meal services, meal service assignments, catering orders), plus the RLS permissions those tables need. No row in any existing table is read, changed, or deleted.

## What this adds

A real Catering section (now in the left sidebar). Producers can record named dietary/allergy profiles for cast and crew. Any production member can manage catering vendors, plan meal services (breakfast/lunch/dinner/craft service, with a location and assigned people), see an **anonymized** dietary summary per service (counts by severity — no names), and place/cancel a catering order with a vendor.

## Before you run anything

1. **Confirm you are connected to the correct Supabase project.**
2. **Run this during low traffic** if convenient — though since nothing here touches existing data, the risk is low.
3. **Do not modify the SQL script below.**

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (between "SCRIPT BEGINS HERE" and "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution — it's wrapped in `begin; ... commit;`.
4. Watch the output.

## What success looks like

Near the end of the output, a `NOTICE` line reading exactly:

```
ALL P12 CUTOVER INVARIANTS PASSED (0022) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded. **You do not need to do anything else.**

## What failure looks like, and what to do

If the prerequisite migrations aren't live yet (0016-0021, from the earlier cutovers), or this script has already been run, it raises `PRE-FLIGHT ABORT:` naming exactly what didn't match, and Postgres automatically rolls back the entire transaction — nothing is left half-applied. Tested against real PostgreSQL 16: a full successful run, a re-run against an already-migrated database, a run against a database missing the prerequisites, and a post-cutover functional check.

If you get any exception:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code is not deployed yet; merging it is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
-- ============================================================================
-- FilmSet -- P12 Cutover Script (0022)
-- Generated to accompany the Catering domain PR (claude/p12-catering-domain).
-- Applies migration 0022_catering_domain.sql against live Supabase.
--
-- Purely additive, same posture as the P10/P11 cutovers: no existing
-- data is read, changed, or deleted. New, empty tables plus RLS
-- policies only. The pre-flight below confirms the prerequisite
-- migrations (through 0021) are already live, and that this script
-- hasn't already been run, before touching anything.
--
-- If this reaches commit; and prints the success notice, every
-- invariant held. If ANY check fails, Postgres has already rolled back
-- the entire transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'vehicles') then
    raise exception 'PRE-FLIGHT ABORT: public.vehicles not found -- migration 0021 does not appear to be live yet. This script depends on 0016-0021 already being applied.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    raise exception 'PRE-FLIGHT ABORT: public.bookings not found -- migration 0018 does not appear to be live yet.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'dietary_profiles') then
    raise exception 'PRE-FLIGHT ABORT: public.dietary_profiles already exists -- migration 0022 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: 0016-0021 are live, 0022 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0022_catering_domain.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P12 -- Catering domain. Third real Logistics subdomain built on the
-- Booking Engine, per docs/audits/LOGISTICS_DOMAIN_MODEL.md §6 and
-- docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4's recommended
-- build order (Catering last, after Accommodation and Transportation).
--
-- Scoped deliberately narrower than §6's full model for a first working
-- v1: DietaryProfile, DietaryRequirement, MealService,
-- MealServiceAssignment, CateringVendor, and CateringOrder are built.
-- CraftService is NOT a separate table -- meal_services.meal_type
-- includes 'CRAFT' as one of its values, covering a standing/ongoing
-- craft service as a service like any other rather than inventing a
-- second entity shape for it (a documented simplification, not a silent
-- drop -- §6's own distinction between scheduled and standing service is
-- real and can be revisited if it matters in practice). MealCount is NOT
-- a stored table -- per §6's own stated principle for every Logistics
-- document ("generated views over the structured entities above -- never
-- a separately-maintained document"), aggregate meal counts are computed
-- live by the Server Actions in this same PR from
-- meal_service_assignments joined to dietary_requirements, not
-- pre-aggregated and stored. Since no MealCount is stored, MealAdjustment
-- (a correction to a derived count) has nothing to adjust and is
-- deferred with it.
--
-- The sensitive-data permission split (§6's explicit requirement --
-- catering.dietary.view_individual / view_operational /
-- catering.counts.view_aggregate, already seeded as real permissions by
-- 0017_authorization_foundation.sql) is enforced by this PR's Server
-- Actions at the app layer with the SAME interim gate every prior write
-- action in this train uses (requireProductionMember(productionId,
-- ["Producer"])) -- not by wiring the authorize() engine, which stays
-- deliberately unwired in every PR so far (0017's own P1c scope note).
-- RLS below stays membership-scoped like every other table in this
-- migration train, including the sensitive dietary_profiles/
-- dietary_requirements tables -- RLS is the membership backstop, the
-- app layer is where the real business rule (who sees a named person's
-- allergy info) is enforced, exactly like Department write actions'
-- Producer gate today.
--
-- Ships WITH real Server Actions and a real screen in the same PR, so
-- full read+write RLS from the start, matching Accommodation (0020) and
-- Transportation (0021)'s posture.
-- ============================================================================

-- ============================================================================
-- dietary_profiles / dietary_requirements -- §6's DietaryProfile/
-- DietaryRequirement. Same polymorphic person pattern as stays/
-- movement_leg_passengers (cast and crew are two separate tables, no
-- unified "people" table exists).
-- ============================================================================
create table public.dietary_profiles (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  person_type text not null,
  cast_member_id text references public.cast_members(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dietary_profiles_person_type_valid check (person_type in ('CAST', 'CREW')),
  constraint dietary_profiles_exactly_one_person check (
    (person_type = 'CAST' and cast_member_id is not null and crew_member_id is null)
    or (person_type = 'CREW' and crew_member_id is not null and cast_member_id is null)
  )
);
create index dietary_profiles_production_idx on public.dietary_profiles (production_id);
create index dietary_profiles_cast_member_idx on public.dietary_profiles (cast_member_id);
create index dietary_profiles_crew_member_idx on public.dietary_profiles (crew_member_id);
-- A plain UNIQUE constraint across (person_type, cast_member_id, crew_member_id) wouldn't
-- actually enforce "one profile per person": Postgres treats NULL as distinct from NULL, so
-- two CAST rows (crew_member_id NULL on both) would never collide on that column and the
-- constraint would silently do nothing for the exact case it exists to prevent. Two partial
-- unique indexes, each only over the column that's actually non-null for that person_type,
-- enforce it correctly.
create unique index dietary_profiles_one_per_cast_member on public.dietary_profiles (production_id, cast_member_id) where person_type = 'CAST';
create unique index dietary_profiles_one_per_crew_member on public.dietary_profiles (production_id, crew_member_id) where person_type = 'CREW';

/** The structured half of a profile (e.g. "Nut allergy -- Severe") -- free-text notes live on dietary_profiles itself. */
create table public.dietary_requirements (
  id text primary key,
  profile_id text not null references public.dietary_profiles(id) on delete cascade,
  requirement_type text not null,
  severity text not null default 'PREFERENCE',
  created_at timestamptz not null default now(),
  constraint dietary_requirements_severity_valid check (severity in ('PREFERENCE', 'MILD', 'SEVERE'))
);
create index dietary_requirements_profile_idx on public.dietary_requirements (profile_id);

-- ============================================================================
-- catering_vendors -- §6's CateringVendor.
-- ============================================================================
create table public.catering_vendors (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  contact text,
  contract_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catering_vendors_production_idx on public.catering_vendors (production_id);

-- ============================================================================
-- meal_services -- §6's MealService. meal_type 'CRAFT' covers §6's
-- CraftService case, per this file's header comment.
-- ============================================================================
create table public.meal_services (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  date timestamptz not null,
  meal_type text not null,
  location_id text references public.locations(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_services_meal_type_valid check (meal_type in ('BREAKFAST', 'LUNCH', 'DINNER', 'CRAFT'))
);
create index meal_services_production_idx on public.meal_services (production_id);

/** §6's MealServiceAssignment -- who's expected at a service. Same polymorphic person pattern. */
create table public.meal_service_assignments (
  id text primary key,
  service_id text not null references public.meal_services(id) on delete cascade,
  person_type text not null,
  cast_member_id text references public.cast_members(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint meal_service_assignments_person_type_valid check (person_type in ('CAST', 'CREW')),
  constraint meal_service_assignments_exactly_one_person check (
    (person_type = 'CAST' and cast_member_id is not null and crew_member_id is null)
    or (person_type = 'CREW' and crew_member_id is not null and cast_member_id is null)
  )
);
create index meal_service_assignments_service_idx on public.meal_service_assignments (service_id);
create index meal_service_assignments_cast_member_idx on public.meal_service_assignments (cast_member_id);
create index meal_service_assignments_crew_member_idx on public.meal_service_assignments (crew_member_id);

-- ============================================================================
-- catering_orders -- §6's CateringOrder, the Booking (0018) subtype:
-- a CateringOrder IS the bookings row's subject (subjectType:
-- "CATERING_ORDER", subjectId: catering_orders.id), mirroring exactly how
-- a Stay/Movement anchors its own booking. Status lives on the linked
-- bookings row, not duplicated here.
-- ============================================================================
create table public.catering_orders (
  id text primary key,
  service_id text not null references public.meal_services(id) on delete cascade,
  vendor_id text references public.catering_vendors(id) on delete set null,
  booking_id text references public.bookings(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catering_orders_service_idx on public.catering_orders (service_id);
create index catering_orders_vendor_idx on public.catering_orders (vendor_id);
create index catering_orders_booking_idx on public.catering_orders (booking_id);

-- ============================================================================
-- RLS -- full read+write, membership-scoped, matching 0020/0021's
-- established posture. See this file's header comment for why
-- dietary_profiles/dietary_requirements stay at this same posture rather
-- than a tighter, permission-based policy.
-- ============================================================================
alter table public.dietary_profiles enable row level security;
create policy "members access dietary_profiles" on public.dietary_profiles for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.dietary_requirements enable row level security;
create policy "members access dietary_requirements" on public.dietary_requirements for all
  to authenticated
  using (
    exists (
      select 1 from public.dietary_profiles p
      where p.id = dietary_requirements.profile_id
        and public.is_production_member(p.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.dietary_profiles p
      where p.id = dietary_requirements.profile_id
        and public.is_production_member(p.production_id)
    )
  );

alter table public.catering_vendors enable row level security;
create policy "members access catering_vendors" on public.catering_vendors for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.meal_services enable row level security;
create policy "members access meal_services" on public.meal_services for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.meal_service_assignments enable row level security;
create policy "members access meal_service_assignments" on public.meal_service_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.meal_services s
      where s.id = meal_service_assignments.service_id
        and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.meal_services s
      where s.id = meal_service_assignments.service_id
        and public.is_production_member(s.production_id)
    )
  );

alter table public.catering_orders enable row level security;
create policy "members access catering_orders" on public.catering_orders for all
  to authenticated
  using (
    exists (
      select 1 from public.meal_services s
      where s.id = catering_orders.service_id
        and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.meal_services s
      where s.id = catering_orders.service_id
        and public.is_production_member(s.production_id)
    )
  );

-- ============================================================================
-- bookings write RLS already exists (0020 added it for Accommodation) --
-- Catering reuses the same INSERT/UPDATE policies on `bookings` and the
-- same INSERT policy on `booking_cancellations`, scoped identically by
-- production_id. Nothing to add here.
--
-- Deliberately NOT changed by this migration:
-- - CraftService / MealCount / MealAdjustment -- not built, per this
--   file's header comment.
-- - No RLS policy anywhere checks catering.dietary.view_individual/
--   view_operational/catering.counts.view_aggregate -- those permissions
--   (already seeded by 0017) are enforced at the app layer in this PR's
--   Server Actions via the same interim Producer-only gate every prior
--   write action in this train uses, not via authorize(), which stays
--   unwired.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0022_catering_domain.sql
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
    and table_name in ('dietary_profiles', 'dietary_requirements', 'catering_vendors', 'meal_services', 'meal_service_assignments', 'catering_orders');
  if v_new_tables <> 6 then
    raise exception 'INVARIANT FAILED: expected 6 new catering tables, found %', v_new_tables;
  end if;

  select
    (select count(*) from public.dietary_profiles)
    + (select count(*) from public.dietary_requirements)
    + (select count(*) from public.catering_vendors)
    + (select count(*) from public.meal_services)
    + (select count(*) from public.meal_service_assignments)
    + (select count(*) from public.catering_orders)
  into v_row_count;
  if v_row_count <> 0 then
    raise exception 'INVARIANT FAILED: all six new catering tables should be empty immediately after this migration, found % total rows across them', v_row_count;
  end if;

  select count(distinct tablename) into v_write_policy_tables
  from pg_policies
  where schemaname = 'public'
    and tablename in ('dietary_profiles', 'dietary_requirements', 'catering_vendors', 'meal_services', 'meal_service_assignments', 'catering_orders')
    and cmd = 'ALL';
  if v_write_policy_tables <> 6 then
    raise exception 'INVARIANT FAILED: expected all 6 new tables to have a FOR ALL policy, found % with one', v_write_policy_tables;
  end if;

  raise notice 'ALL P12 CUTOVER INVARIANTS PASSED (0022) -- safe to commit.';
end $postcheck$;

commit;

```

# SCRIPT ENDS HERE
