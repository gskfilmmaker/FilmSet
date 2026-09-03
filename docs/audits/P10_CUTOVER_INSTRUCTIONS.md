# Instructions — FilmSet P10 Live Supabase Cutover (0019 + 0020)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is different from the last cutover

The previous cutover (0016-0018) dealt with real, existing production data (the Vrindavan production, existing accounts) and needed careful, name/id-anchored checks because of that. **This one does not touch any existing data at all.** It only:

1. Adds three missing write permissions (Postgres Row-Level-Security policies) on two tables that already exist (`department_memberships`, `department_head_assignments`) — fixing a real bug where two already-live screens throw a permission error whenever anyone tries to use them.
2. Creates four brand-new, empty tables for a new Accommodation (hotel booking) feature, plus the write permissions those and the existing `bookings` table need.

No row in any existing table is read, changed, or deleted by this script. The pre-flight check below only confirms the prerequisite migrations are already live and that this script hasn't already been run — there's no "which production is this" ambiguity to resolve.

## What this fixes and adds

**The bug fix**: right now, on the live app, going to Settings → Departments → any department → trying to change the Head of Department, add a member, remove a member, or change someone's role — all of these fail with a database permission error. The feature was built and deployed, but the database was never given permission to accept the writes it makes. This script fixes that; nothing else about those screens changes.

**The new feature**: a real Accommodation section (now in the left sidebar) for booking cast/crew into hotel rooms — properties, room types, and bookable stays with check-in/check-out dates, tied into the existing booking-tracking tables that were created earlier but never used until now.

## Before you run anything

1. **Confirm you are connected to the correct Supabase project** — the one backing the real, live FilmSet app.
2. **Run this during low traffic** if convenient — though since nothing here touches existing data, the risk of running it live is low.
3. **Do not modify the SQL script below.** It has been tested exactly as written.

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (everything between the `-- ============` divider marked "SCRIPT BEGINS HERE" and the one marked "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution. It is wrapped in `begin; ... commit;` — Postgres will treat it as one all-or-nothing transaction.
4. Watch the output.

## What success looks like

If everything is correct, near the end of the output you will see a `NOTICE` line reading exactly:

```
ALL P10 CUTOVER INVARIANTS PASSED (0019 + 0020) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded and the transaction has already committed. **You do not need to do anything else.**

## What failure looks like, and what to do

If the prerequisite migrations aren't live yet, or this script has already been run, it will raise an exception starting `PRE-FLIGHT ABORT:` naming exactly what didn't match, and **Postgres automatically rolls back the entire transaction** — nothing is left half-applied. This has been specifically tested (both abort conditions, and a full successful run) against real PostgreSQL 16.

If you get any exception:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code (PR #35) is not deployed yet; merging it is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
-- ============================================================================
-- FilmSet -- P10 Cutover Script (0019 + 0020)
-- Generated to accompany PR #35 (claude/p10-accommodation-hotel-booking).
-- Applies, in order, against live Supabase:
--   0019_department_write_policies.sql  (bug fix -- department write RLS)
--   0020_accommodation_domain.sql       (new -- Accommodation/hotel booking schema)
--
-- Unlike the earlier P1a-P9 cutover, this one is purely additive and
-- touches NO existing data: 0019 only adds RLS policies (no rows
-- affected), and 0020 only creates brand-new, empty tables plus RLS
-- policies on the pre-existing (and previously-unused) bookings/
-- booking_cancellations tables. There is no name/identity ambiguity to
-- guard against here -- the pre-flight below only confirms the
-- prerequisite migrations (through 0018) are already live, and that
-- this script hasn't already been run, before touching anything.
--
-- If this reaches commit; and prints the success notice, every
-- invariant held. If ANY check fails, Postgres has already rolled back
-- the entire transaction -- nothing is left half-applied. rollback; (in
-- place of commit;) is always available if a manual review after the
-- notice still looks wrong before committing.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'departments') then
    raise exception 'PRE-FLIGHT ABORT: public.departments not found -- migration 0017 does not appear to be live yet. This script depends on 0016-0018 already being applied.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    raise exception 'PRE-FLIGHT ABORT: public.bookings not found -- migration 0018 does not appear to be live yet. This script depends on 0016-0018 already being applied.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'department_head_assignments') then
    raise exception 'PRE-FLIGHT ABORT: public.department_head_assignments not found -- migration 0017 does not appear to be live yet.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'accommodation_properties') then
    raise exception 'PRE-FLIGHT ABORT: public.accommodation_properties already exists -- migration 0020 appears to already be live. Not safe to run this script again.';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_memberships' and policyname = 'production members write department_memberships'
  ) then
    raise exception 'PRE-FLIGHT ABORT: department_memberships already has a write policy named "production members write department_memberships" -- migration 0019 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: 0016-0018 are live, 0019/0020 are not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0019_department_write_policies.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- Bug fix, found while building the Accommodation domain (next migration):
-- PR #31 (P6) shipped real, wired Server Actions
-- (apps/web/app/settings/departments/actions.ts — setDepartmentHead,
-- addDepartmentMember, removeDepartmentMember, changeDepartmentMemberRole)
-- that insert/update/delete department_memberships and
-- department_head_assignments via runAsUser, which really does
-- `set local role authenticated` before every query — the same RLS path
-- every real Server Action in this app goes through.
--
-- But 0017_authorization_foundation.sql only ever added SELECT policies
-- for those two tables, matching that migration's own "schema only,
-- unwired" scope at the time it was written. P6 wired real writes on top
-- without adding the write policies those writes need.
--
-- Confirmed with a real local PostgreSQL 16 check, run as the actual
-- `authenticated` role (not the table-owner role P6's own local
-- verification used, which bypasses RLS entirely and so never caught
-- this): inserting into department_memberships as `authenticated` fails
-- with "new row violates row-level security policy for table
-- department_memberships". Every one of the four actions above fails the
-- same way today in production, the moment any user actually uses the
-- Membership screen (Settings → Departments → a department →
-- Change HOD / add or remove a member / change a role).
--
-- Fix: add INSERT/UPDATE/DELETE policies to both tables, scoped to
-- production membership via the same join shape
-- department_head_assignments' own SELECT policy already uses. This
-- matches the established pattern for every other production-scoped
-- content table (0001_rls_and_auth_trigger.sql's characters/
-- cast_members/crew_members/etc: RLS enforces membership, the stricter
-- Producer-only check is left to the app layer via
-- requireProductionMember(productionId, ["Producer"]), exactly as these
-- four actions already do). Existing SELECT policies are left completely
-- untouched — their read scope doesn't change, only writes go from
-- always-denied to membership-gated.
-- ============================================================================

create policy "production members write department_memberships" on public.department_memberships for insert
  to authenticated
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members update department_memberships" on public.department_memberships for update
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members delete department_memberships" on public.department_memberships for delete
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_memberships.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members write HOD assignments" on public.department_head_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_head_assignments.department_id
        and public.is_production_member(d.production_id)
    )
  );

create policy "production members delete HOD assignments" on public.department_head_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_head_assignments.department_id
        and public.is_production_member(d.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed:
-- - department_permissions / department_budget_scopes stay read-only —
--   no Server Action writes to either yet, so no write policy is needed
--   for them (adding one now with nothing to exercise it would be
--   speculative, the same reasoning 0017 itself used).
-- - Every SELECT policy on every table, including the two fixed here — no
--   read access changes for anyone.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0019_department_write_policies.sql
-- ============================================================================

-- ============================================================================
-- BEGIN packages/db/migrations/0020_accommodation_domain.sql (pasted verbatim, unmodified)
-- ============================================================================

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

-- ============================================================================
-- END packages/db/migrations/0020_accommodation_domain.sql
-- ============================================================================

do $postcheck$
declare
  v_membership_write_policies int;
  v_hod_write_policies int;
  v_bookings_write_policies int;
  v_cancellation_write_policies int;
  v_new_tables int;
  v_property_rows int;
  v_room_type_rows int;
  v_stay_rows int;
  v_change_rows int;
begin
  select count(*) into v_membership_write_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'department_memberships' and cmd in ('INSERT', 'UPDATE', 'DELETE');
  if v_membership_write_policies <> 3 then
    raise exception 'INVARIANT FAILED: expected 3 write policies (insert/update/delete) on department_memberships, found %', v_membership_write_policies;
  end if;

  select count(*) into v_hod_write_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'department_head_assignments' and cmd in ('INSERT', 'DELETE');
  if v_hod_write_policies <> 2 then
    raise exception 'INVARIANT FAILED: expected 2 write policies (insert/delete) on department_head_assignments, found %', v_hod_write_policies;
  end if;

  select count(*) into v_bookings_write_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'bookings' and cmd in ('INSERT', 'UPDATE');
  if v_bookings_write_policies <> 2 then
    raise exception 'INVARIANT FAILED: expected 2 write policies (insert/update) on bookings, found %', v_bookings_write_policies;
  end if;

  select count(*) into v_cancellation_write_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'booking_cancellations' and cmd = 'INSERT';
  if v_cancellation_write_policies <> 1 then
    raise exception 'INVARIANT FAILED: expected 1 write policy (insert) on booking_cancellations, found %', v_cancellation_write_policies;
  end if;

  select count(*) into v_new_tables
  from information_schema.tables
  where table_schema = 'public' and table_name in ('accommodation_properties', 'room_types', 'stays', 'accommodation_changes');
  if v_new_tables <> 4 then
    raise exception 'INVARIANT FAILED: expected 4 new accommodation tables, found %', v_new_tables;
  end if;

  select count(*) into v_property_rows from public.accommodation_properties;
  select count(*) into v_room_type_rows from public.room_types;
  select count(*) into v_stay_rows from public.stays;
  select count(*) into v_change_rows from public.accommodation_changes;
  if v_property_rows <> 0 or v_room_type_rows <> 0 or v_stay_rows <> 0 or v_change_rows <> 0 then
    raise exception 'INVARIANT FAILED: all four new accommodation tables should be empty immediately after this migration, found % properties, % room types, % stays, % changes',
      v_property_rows, v_room_type_rows, v_stay_rows, v_change_rows;
  end if;

  raise notice 'ALL P10 CUTOVER INVARIANTS PASSED (0019 + 0020) -- safe to commit.';
end $postcheck$;

commit;

```

# SCRIPT ENDS HERE
