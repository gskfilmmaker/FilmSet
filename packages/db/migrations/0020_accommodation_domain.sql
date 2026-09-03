-- ============================================================================
-- P11 — Accommodation (hotel booking) domain. First real Logistics
-- subdomain built on top of the Booking Engine (0018), per
-- docs/audits/LOGISTICS_DOMAIN_MODEL.md §2 and
-- docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4's recommended
-- build order.
--
-- Scoped deliberately narrower than §2's full model for a first real,
-- wired v1: AccommodationProperty, RoomType, and Stay are built (the
-- entities needed to actually book someone into a hotel room and see it
-- on a real screen). AccommodationContract and RoomBlock — bulk,
-- production-level rate agreements and block-booked room inventory —
-- are NOT built here; they're a real future increment for
-- volume/negotiated bookings, deliberately deferred rather than folded
-- in half-designed. A Stay books a room directly against a Property/
-- RoomType, which is the common case (booking one or a few rooms as
-- needed) and everything the UI in this PR actually needs.
--
-- Unlike 0018 (deliberately schema-only, unwired), this migration ships
-- WITH real Server Actions and a real screen in the same PR — so, unlike
-- 0018/0017's original tables, every table here gets full read+write RLS
-- from the start, using the established pattern (0001's
-- characters/cast_members/crew_members/etc): membership-scoped at the
-- RLS layer, with `requireProductionMember` doing the app-layer check.
-- ============================================================================

-- ============================================================================
-- accommodation_properties — the physical place (LOGISTICS_DOMAIN_MODEL.md
-- §2's AccommodationProperty).
-- ============================================================================
create table public.accommodation_properties (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  type text not null default 'HOTEL',
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accommodation_properties_production_idx on public.accommodation_properties (production_id);

-- ============================================================================
-- room_types — standard/suite/etc per property (§2's RoomType).
-- ============================================================================
create table public.room_types (
  id text primary key,
  property_id text not null references public.accommodation_properties(id) on delete cascade,
  name text not null,
  capacity integer not null default 1,
  created_at timestamptz not null default now()
);
create index room_types_property_idx on public.room_types (property_id);

-- ============================================================================
-- stays — the traveler-facing record (§2's Stay), the AccommodationBooking
-- subtype folded in directly rather than as a separate table: this Stay
-- IS the booking's subject (bookings.subject_type = 'ACCOMMODATION_STAY',
-- bookings.subject_id = stays.id), so a second wrapper table would only
-- duplicate the link `stays.booking_id` already carries the other way.
--
-- person_type/cast_member_id/crew_member_id: cast and crew are two
-- separate tables in this schema (no unified "people" table exists), so
-- the polymorphic personRef the domain model calls for is expressed as
-- two nullable, real foreign keys plus a check constraint pinning exactly
-- one of them — real referential integrity instead of a stringly-typed
-- id column, at the cost of one column that's always null.
-- ============================================================================
create table public.stays (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  property_id text not null references public.accommodation_properties(id) on delete restrict,
  room_type_id text references public.room_types(id) on delete set null,
  person_type text not null,
  cast_member_id text references public.cast_members(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  check_in timestamptz not null,
  check_out timestamptz not null,
  room_number text,
  /** Explicit sharing pairing — §2's RoomAssignment "sharing flag", without the full RoomBlock/RoomAssignment layer this v1 defers. */
  shared_with_stay_id text references public.stays(id) on delete set null,
  /** Set once bookStay() creates the matching bookings row — nullable only for the instant between the two inserts inside the same transaction. */
  booking_id text references public.bookings(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stays_check_out_after_check_in check (check_out > check_in),
  constraint stays_person_type_valid check (person_type in ('CAST', 'CREW')),
  constraint stays_exactly_one_person check (
    (person_type = 'CAST' and cast_member_id is not null and crew_member_id is null)
    or (person_type = 'CREW' and crew_member_id is not null and cast_member_id is null)
  )
);
create index stays_production_idx on public.stays (production_id);
create index stays_property_idx on public.stays (property_id);
create index stays_cast_member_idx on public.stays (cast_member_id);
create index stays_crew_member_idx on public.stays (crew_member_id);
create index stays_booking_idx on public.stays (booking_id);

-- ============================================================================
-- accommodation_changes — structured diff on a Stay change (§2's
-- AccommodationChange), mirroring booking_changes' shape exactly.
-- ============================================================================
create table public.accommodation_changes (
  id text primary key,
  stay_id text not null references public.stays(id) on delete cascade,
  change_type text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index accommodation_changes_stay_idx on public.accommodation_changes (stay_id);

-- ============================================================================
-- RLS — full read+write, membership-scoped, matching 0001's established
-- pattern for production-scoped content tables. The stricter "who may
-- book/cancel" check (currently: any production member, same posture as
-- Locations/Crew/Cast) lives at the app layer in the Server Actions.
-- ============================================================================
alter table public.accommodation_properties enable row level security;
create policy "members access accommodation_properties" on public.accommodation_properties for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.room_types enable row level security;
create policy "members access room_types" on public.room_types for all
  to authenticated
  using (
    exists (
      select 1 from public.accommodation_properties p
      where p.id = room_types.property_id
        and public.is_production_member(p.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.accommodation_properties p
      where p.id = room_types.property_id
        and public.is_production_member(p.production_id)
    )
  );

alter table public.stays enable row level security;
create policy "members access stays" on public.stays for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.accommodation_changes enable row level security;
create policy "members access accommodation_changes" on public.accommodation_changes for all
  to authenticated
  using (
    exists (
      select 1 from public.stays s
      where s.id = accommodation_changes.stay_id
        and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.stays s
      where s.id = accommodation_changes.stay_id
        and public.is_production_member(s.production_id)
    )
  );

-- ============================================================================
-- bookings / booking_cancellations write RLS — 0018 deliberately left
-- every write on these DENIED ("no Server Action reads or writes any of
-- these tables yet"). This migration's own Server Actions are the first
-- to actually do so (bookStay() inserts a bookings row; cancelStay()
-- updates it and inserts a booking_cancellations row) — so, per 0018's
-- own comment ("both columns are written by whichever subdomain
-- migration lands first"), granting the write access it withheld is this
-- migration's job, not a re-opening of 0018's own scope. Confirmed
-- necessary the same way the department fix above was: a real local
-- Postgres check as `authenticated` failed on the plain bookings insert
-- before these policies were added.
-- ============================================================================
create policy "production members write bookings" on public.bookings for insert
  to authenticated
  with check (public.is_production_member(production_id));

create policy "production members update bookings" on public.bookings for update
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

create policy "production members write booking cancellations" on public.booking_cancellations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_cancellations.booking_id
        and public.is_production_member(b.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed by this migration:
-- - booking_quotes/booking_confirmations/booking_changes (0018) stay
--   read-only — this v1's bookStay()/cancelStay() don't use a quote,
--   vendor confirmation, or structured booking-level change record
--   (Stay edits log to accommodation_changes above instead). Real future
--   work once those flows exist here, same reasoning as 0017's
--   department_permissions/department_budget_scopes deferral.
-- - approval_workflows/approval_stages/approval_rules/approval_requests/
--   approval_decisions/commitments/invoices — untouched; this v1 books
--   directly into 'BOOKED' status with no approval step, as this file's
--   opening comment says.
-- - No approval workflow is auto-created or required for a Stay booking
--   in this v1 — bookStay() below creates the booking directly in
--   'BOOKED' status. Routing accommodation bookings through the
--   Approval Engine (0018 §0.2) is real future work once an
--   ApprovalWorkflow actually exists for a production to select.
-- - AccommodationContract / RoomBlock / RoomAssignment
--   (LOGISTICS_DOMAIN_MODEL.md §2) — not built, per this file's opening
--   comment.
-- ============================================================================
