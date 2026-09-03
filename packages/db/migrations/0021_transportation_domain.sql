-- ============================================================================
-- P11 -- Transportation domain (vehicle/driver movement booking). Second
-- real Logistics subdomain built on the Booking Engine (0018), per
-- docs/audits/LOGISTICS_DOMAIN_MODEL.md §3 and
-- docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4's recommended
-- build order (Transportation next after Accommodation, as the highest-
-- continuity slice from today's real productionVehicleSchema/
-- transportRunSchema).
--
-- Today's `production_vehicles`/`transport_runs` fixture-era fields
-- (packages/core's productionVehicleSchema/transportRunSchema, wired into
-- the shoot-day call sheet) are NOT touched or migrated by this file --
-- they stay exactly what they are today: free-text, single-shoot-day
-- display fields on the call sheet. Nothing here reads or writes them.
-- This migration adds a parallel, real booking system; reconciling the
-- two (e.g. having the call sheet read from real Movement/Vehicle rows)
-- is real, separate future work, the same relationship P1b's migration
-- note describes between department_head_assignments and
-- crew_members.is_hod.
--
-- Scoped deliberately narrower than §3's full model for a first working
-- v1: Vehicle, Driver, DriverQualification, Movement, MovementLeg, and a
-- passenger manifest are built. Route/PickupPoint as their own reusable
-- entities are NOT built -- movement_legs.pickup/dropoff link directly to
-- the existing `locations` table (reused, not duplicated) with a
-- free-text fallback, which covers the common case without inventing a
-- second "places" concept. A separate MovementAssignment table (so
-- reassigning a vehicle/driver doesn't rewrite the leg's schedule) is
-- also deferred -- vehicle_id/driver_id live directly on the leg for v1.
-- Both deferrals are real future increments, not silently dropped scope.
--
-- Conflict detection (§3's vehicle/driver/passenger/capacity conflicts)
-- is a computed, cross-row check per the domain model -- not something
-- this migration stores. This migration's own Server Actions (not SQL)
-- enforce the unambiguous cases at write time (same vehicle or driver
-- assigned to two legs at the exact same scheduled_time; a leg's
-- passenger count exceeding its vehicle's capacity) rather than only
-- flagging them after the fact in a future Control Center.
--
-- Ships WITH real Server Actions and a real screen in the same PR as
-- Accommodation did -- full read+write RLS from the start, matching that
-- migration's posture, not 0018's original unwired one.
-- ============================================================================

-- ============================================================================
-- vehicles -- LOGISTICS_DOMAIN_MODEL.md §3's Vehicle, with `type` as a
-- free-text column (matching accommodation_properties.type's own
-- convention) rather than a separate VehicleType table -- it's a fixed
-- picklist enforced at the UI layer, not data with its own lifecycle.
-- ============================================================================
create table public.vehicles (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  type text not null default 'PRODUCTION_VEHICLE',
  identifier text not null,
  capacity integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_production_idx on public.vehicles (production_id);

-- ============================================================================
-- drivers -- §3's Driver. crewMemberId/externalName: most drivers are
-- crew, but some productions use an external taxi/chauffeur service with
-- no crew record at all (§3's "External Taxi/Chauffeur" vehicle type) --
-- same nullable-pair-plus-check-constraint pattern as stays'
-- castMemberId/crewMemberId, adapted to an optional second case (no
-- linked person record at all) rather than a required either/or.
-- ============================================================================
create table public.drivers (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  external_name text,
  notes text,
  created_at timestamptz not null default now(),
  constraint drivers_exactly_one_identity check (
    (crew_member_id is not null and external_name is null)
    or (crew_member_id is null and external_name is not null)
  )
);
create index drivers_production_idx on public.drivers (production_id);
create index drivers_crew_member_idx on public.drivers (crew_member_id);

-- ============================================================================
-- driver_qualifications -- §3's DriverQualification. Tracked for
-- reference/display in this v1; not yet cross-checked against a leg's
-- requirements when assigning a driver (no per-leg "required
-- qualification" field exists to check against -- that's real future
-- work alongside the Control Center's own conflict surfacing).
-- ============================================================================
create table public.driver_qualifications (
  id text primary key,
  driver_id text not null references public.drivers(id) on delete cascade,
  qualification_type text not null,
  expiry_date timestamptz,
  created_at timestamptz not null default now()
);
create index driver_qualifications_driver_idx on public.driver_qualifications (driver_id);

-- ============================================================================
-- movements -- §3's Movement. Also the VehicleBooking subtype's anchor:
-- a Movement IS the bookings row's subject (subjectType:
-- "TRANSPORT_MOVEMENT", subjectId: movements.id), created alongside it,
-- mirroring exactly how a Stay anchors an accommodation booking.
-- ============================================================================
create table public.movements (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  date timestamptz not null,
  purpose text not null,
  /** PLANNED | CONFIRMED | DRIVER_ASSIGNED | READY | BOARDING | EN_ROUTE | ARRIVED | COMPLETED | CANCELLED (§3). */
  status text not null default 'PLANNED',
  booking_id text references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movements_status_valid check (
    status in ('PLANNED', 'CONFIRMED', 'DRIVER_ASSIGNED', 'READY', 'BOARDING', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED')
  )
);
create index movements_production_idx on public.movements (production_id);
create index movements_booking_idx on public.movements (booking_id);

-- ============================================================================
-- movement_legs -- §3's MovementLeg, with vehicle_id/driver_id inline
-- (MovementAssignment deferred, per this file's header comment).
-- pickup/dropoff reuse the existing `locations` table with a free-text
-- fallback (a pickup spot -- an airport, a hotel lobby -- isn't always
-- one of the production's own scouted locations).
-- ============================================================================
create table public.movement_legs (
  id text primary key,
  movement_id text not null references public.movements(id) on delete cascade,
  pickup_location_id text references public.locations(id) on delete set null,
  pickup_notes text,
  dropoff_location_id text references public.locations(id) on delete set null,
  dropoff_notes text,
  scheduled_time timestamptz not null,
  vehicle_id text references public.vehicles(id) on delete set null,
  driver_id text references public.drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index movement_legs_movement_idx on public.movement_legs (movement_id);
create index movement_legs_vehicle_idx on public.movement_legs (vehicle_id);
create index movement_legs_driver_idx on public.movement_legs (driver_id);

-- ============================================================================
-- movement_leg_passengers -- §3's PassengerManifest. Same polymorphic
-- person pattern as stays.castMemberId/crewMemberId.
-- ============================================================================
create table public.movement_leg_passengers (
  id text primary key,
  leg_id text not null references public.movement_legs(id) on delete cascade,
  person_type text not null,
  cast_member_id text references public.cast_members(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint movement_leg_passengers_person_type_valid check (person_type in ('CAST', 'CREW')),
  constraint movement_leg_passengers_exactly_one_person check (
    (person_type = 'CAST' and cast_member_id is not null and crew_member_id is null)
    or (person_type = 'CREW' and crew_member_id is not null and cast_member_id is null)
  )
);
create index movement_leg_passengers_leg_idx on public.movement_leg_passengers (leg_id);
create index movement_leg_passengers_cast_member_idx on public.movement_leg_passengers (cast_member_id);
create index movement_leg_passengers_crew_member_idx on public.movement_leg_passengers (crew_member_id);

-- ============================================================================
-- RLS -- full read+write, membership-scoped, matching 0020's
-- Accommodation posture (and 0001's established pattern for every
-- production-scoped content table).
-- ============================================================================
alter table public.vehicles enable row level security;
create policy "members access vehicles" on public.vehicles for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.drivers enable row level security;
create policy "members access drivers" on public.drivers for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.driver_qualifications enable row level security;
create policy "members access driver_qualifications" on public.driver_qualifications for all
  to authenticated
  using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_qualifications.driver_id
        and public.is_production_member(d.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.drivers d
      where d.id = driver_qualifications.driver_id
        and public.is_production_member(d.production_id)
    )
  );

alter table public.movements enable row level security;
create policy "members access movements" on public.movements for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.movement_legs enable row level security;
create policy "members access movement_legs" on public.movement_legs for all
  to authenticated
  using (
    exists (
      select 1 from public.movements m
      where m.id = movement_legs.movement_id
        and public.is_production_member(m.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.movements m
      where m.id = movement_legs.movement_id
        and public.is_production_member(m.production_id)
    )
  );

alter table public.movement_leg_passengers enable row level security;
create policy "members access movement_leg_passengers" on public.movement_leg_passengers for all
  to authenticated
  using (
    exists (
      select 1 from public.movement_legs l
      join public.movements m on m.id = l.movement_id
      where l.id = movement_leg_passengers.leg_id
        and public.is_production_member(m.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.movement_legs l
      join public.movements m on m.id = l.movement_id
      where l.id = movement_leg_passengers.leg_id
        and public.is_production_member(m.production_id)
    )
  );

-- ============================================================================
-- bookings write RLS already exists (0020 added it for Accommodation) --
-- Transportation reuses the same INSERT/UPDATE policies on `bookings`
-- and the same INSERT policy on `booking_cancellations`, scoped
-- identically by production_id. Nothing to add here.
--
-- Deliberately NOT changed by this migration:
-- - production_vehicles / transport_runs (packages/core, wired into the
--   shoot-day call sheet) -- untouched, per this file's header comment.
-- - Route / PickupPoint as first-class entities, MovementAssignment as
--   its own table -- deferred, per this file's header comment.
-- ============================================================================
