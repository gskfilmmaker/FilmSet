# Instructions — FilmSet P16 Live Supabase Cutover (0025)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is

Security & Access, Phase A — the database + RLS foundation for a generic, domain-neutral physical identity/credential/access-control platform, per the owner's "MASTER CLAUDE CODE IMPLEMENTATION INSTRUCTION." This is schema only: it creates 15 brand-new, empty tables (identities, credentials, resources, access profiles/rules, grants, restrictions, checkpoints, devices, device enrollments, the access-event ledger, temporary grants, visitor details, incidents) with full row-level security enabled and a **read-only** policy on every one of them. No application code reads or writes any of these tables yet — the corresponding Server Actions, API routes, QR generation/verification, and UI are separate, later-phase work that has not been authorized or built.

**This is purely additive, same posture as P10–P14.** Zero `ALTER TABLE` against any existing table, zero backfill, zero data migration. No existing row in any existing table is read, changed, or deleted by this script.

## What this adds

- **`access_identities`** — a generic Person/Identity wrapper around existing `cast_members`/`crew_members` records (or, for people with no existing FilmSet record — a visitor/vendor/contractor — an `EXTERNAL` case carrying its own name/company/photo).
- **`access_credentials`** — credential lifecycle (`DRAFT → PENDING_APPROVAL → ACTIVE → SUSPENDED/LOST/REVOKED/EXPIRED/REPLACED`), the opaque `public_reference` a QR code would encode (no personnel data), and an `assurance_level` axis.
- **`access_resources`** — an arbitrary-depth hierarchical zone/gate/room tree, optionally rooted at an existing `locations` row.
- **`access_profiles` / `access_profile_rules` / `access_identity_profiles`** — reusable, named access templates assignable to many identities.
- **`access_grants`** and **`access_restrictions`** — individual overrides and explicit blocks (restrictions override grants).
- **`access_checkpoints`** — physical gates/doors, with direction and anti-passback modes.
- **`access_devices`** and **`access_device_enrollments`** — scanner devices as first-class trusted principals, with a short-lived, one-time, hashed-token enrollment flow.
- **`access_events`** — the append-only verification ledger.
- **`access_temporary_grants`** — time-boxed grants that stop applying on their own past `valid_until`.
- **`access_visitor_details`** and **`access_incidents`** — visitor-specific fields and security incident tracking.

Every table carries `production_id` only (matching every other production-scoped table in this schema), and every cross-reference within this new domain uses a composite `(id, production_id)` foreign key so a cross-production reference is a database-level impossibility — this was directly tested (see "What was tested" below).

Full design rationale: `docs/security/ARCHITECTURE_ACCESS_CONTROL.md` and the rest of `docs/security/*_ACCESS_CONTROL.md`.

## Before you run anything

1. **Confirm you are connected to the correct Supabase project.**
2. **Run this during low traffic** if convenient — though the risk is low (15 new empty tables, zero changes to any existing table).
3. **Do not modify the SQL script below.**

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (between "SCRIPT BEGINS HERE" and "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution — it's wrapped in `begin; ... commit;`.
4. Watch the output.

## What success looks like

Near the end of the output, a `NOTICE` line reading exactly:

```
ALL P16 CUTOVER INVARIANTS PASSED (0025) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded. **You do not need to do anything else.**

## What failure looks like, and what to do

If the prerequisite migrations aren't live yet (0000–0024, checked via `public.menu_items`, `public.cast_members`, and `public.is_production_member()`), or this script has already been run (checked via `public.access_identities`), it raises `PRE-FLIGHT ABORT:` naming exactly what didn't match, and Postgres automatically rolls back the entire transaction — nothing is left half-applied.

**Tested against real PostgreSQL 16**, in this order:

1. A full successful run against a scratch database with 0000–0024 already applied — reached the exact success `NOTICE` and committed. Verified afterward: all 15 `access_*` tables exist, all 15 have row-level security enabled, all 15 have exactly one `SELECT` policy and zero write policies, and every table was empty immediately after.
2. A re-run of the exact same script against that now-migrated database — correctly aborts with `PRE-FLIGHT ABORT: public.access_identities already exists...` and rolls back.
3. A run against a fresh database with only the Supabase-managed schema stubbed in (no `0000`–`0024` applied at all) — correctly aborts with `PRE-FLIGHT ABORT: public.menu_items not found...` and rolls back.
4. A post-cutover functional attack test: after a successful run, inserting an `access_checkpoints` row in Production A whose `resource_id` points at a resource actually belonging to Production B is rejected outright by Postgres — `ERROR: insert or update on table "access_checkpoints" violates foreign key constraint "access_checkpoints_resource_fk"` — proving the cross-tenant composite foreign keys hold against the live-shaped schema, not just in isolation.

If you get any exception:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code is not deployed yet (Phase A ships no Server Action or UI that touches these tables); merging the PR is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
-- ============================================================================
-- FilmSet -- P16 Cutover Script (0025)
-- Generated to accompany the Security & Access Phase A PR (database + RLS
-- foundation for a generic physical identity/credential/access-control
-- domain -- see docs/security/access-control/README.md).
-- Applies migration 0025_access_control_foundation.sql against live Supabase.
--
-- This is purely additive: 15 brand-new tables, zero ALTER TABLE against
-- any existing table, zero backfill, zero data migration. No existing row
-- in any existing table is read, changed, or deleted by this script.
--
-- The pre-flight below confirms migration 0024 (Catering menu/preferences)
-- is already live and that this script hasn't already been run, before
-- touching anything.
--
-- If this reaches commit and prints the success notice, every invariant
-- held. If ANY check fails, Postgres has already rolled back the entire
-- transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_items') then
    raise exception 'PRE-FLIGHT ABORT: public.menu_items not found -- migration 0024 does not appear to be live yet. This script depends on 0000-0024 already being applied.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cast_members') then
    raise exception 'PRE-FLIGHT ABORT: public.cast_members not found -- this script depends on the core production/cast/crew/location schema already being live.';
  end if;
  if not exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'is_production_member') then
    raise exception 'PRE-FLIGHT ABORT: public.is_production_member() not found -- this script depends on it for every RLS policy below.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_identities') then
    raise exception 'PRE-FLIGHT ABORT: public.access_identities already exists -- migration 0025 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: 0000-0024 are live, 0025 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0025_access_control_foundation.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P16 -- Security & Access, Phase A: database + RLS foundation for a
-- generic physical identity/credential/access-control domain, per the
-- owner's explicit "MASTER CLAUDE CODE IMPLEMENTATION INSTRUCTION" for a
-- Security & Access module intended to eventually become a standalone
-- product. Schema + RLS only in this migration -- no Server Action reads
-- or writes any table created here yet (same posture as
-- 0017_authorization_foundation.sql / 0018_booking_approval_engine.sql:
-- every new table's write access is left DENIED by default -- RLS
-- enabled, no INSERT/UPDATE/DELETE policy for any of them -- since no
-- Server Action writes to any of these tables yet). Wiring Server
-- Actions, a UI, QR generation/verification, and the scanner is
-- deliberately separate, future, explicitly-authorized work (Phases
-- B-F), matching this migration train's own established precedent for
-- shipping schema ahead of the code that uses it.
--
-- GENERIC, NOT FILM-SPECIFIC. Every table/column name below uses
-- domain-neutral vocabulary (identity, credential, resource, checkpoint,
-- device, access event) on purpose -- this is meant to work unmodified
-- for a future standalone access-control product, not just film sets.
-- Film-specific concepts (Wrap Check, call-sheet readiness) belong in a
-- future app-layer adapter, never in this core schema.
--
-- TENANCY: every table below carries production_id only (NOT a redundant
-- organization_id) -- exactly matching every other production-scoped
-- table in this schema (cast_members, crew_members, locations,
-- vehicles, ...). A production's organization is always reachable via
-- productions.organization_id; duplicating it here would be new,
-- inconsistent precedent this migration deliberately avoids. A device
-- or identity that needs to span multiple productions within one
-- organization is a real future need (the master instruction's own
-- "future standalone product" framing) but is explicitly out of scope
-- for this phase -- each row belongs to exactly one production, same as
-- every other domain in this app today.
--
-- CROSS-TENANT INTEGRITY: beyond the FK-to-productions every row gets,
-- every child-to-parent reference WITHIN this new domain (e.g. a
-- checkpoint's resource_id, a device's checkpoint_id) is enforced with a
-- COMPOSITE foreign key against (id, production_id) on the parent table,
-- not just a plain id FK. This makes "checkpoint from Production A
-- pointing at a resource from Production B" a database-level
-- impossibility, not merely an application-layer check -- a stricter,
-- more literal reading of this migration train's existing "no
-- cross-production leak" principle (see 0017's department-scoping
-- comment for the same principle applied differently), using only plain
-- SQL (composite UNIQUE + composite FOREIGN KEY), not a new mechanism
-- (e.g. triggers) inconsistent with how this codebase does DDL.
--
-- IDENTITY MODEL: no separate CrewIdentity/CastIdentity/VisitorIdentity
-- tables (the owner's explicit instruction). access_identities is one
-- generic table every other table in this domain references via
-- identity_id. It reuses the EXACT polymorphic-pair pattern already
-- established repeatedly in this codebase (dietary_profiles,
-- meal_service_assignments: person_type + nullable cast_member_id/
-- crew_member_id pair + a check constraint pinning exactly one) for the
-- CAST/CREW cases, and adds a third EXTERNAL case (a visitor/vendor/
-- contractor with no existing FilmSet person record) carrying its own
-- display_name/company/photo_path directly. security_class is a SEPARATE
-- column from person_category: a crew_member-sourced identity can still
-- be tagged VENDOR or VIP; the two axes (where the identity's underlying
-- record lives vs. how the security domain classifies them) are
-- intentionally decoupled, per the owner's explicit "a person can
-- simultaneously be crew, vendor, ..." requirement.
--
-- QR / CREDENTIAL SECURITY: access_credentials.public_reference is the
-- ONLY thing ever meant to be encoded in a QR code -- a high-entropy,
-- globally-unique, non-sequential opaque string with zero personnel data
-- in it. No name/photo/department/contact information lives on this
-- table or anywhere reachable by scanning a QR alone; a scan must always
-- resolve through a server-side verification path (built in a later
-- phase), never a direct client read of this table. See
-- docs/security/QR_SECURITY_ACCESS_CONTROL.md.
--
-- DEVICE ENROLLMENT: access_device_enrollments is a short-lived,
-- one-time, HASHED token table (never the raw token) backing the secure
-- scanner-enrollment flow (owner's spec §14) -- a device becomes TRUSTED
-- only after an admin consumes/approves a still-valid, unused token.
-- ============================================================================

-- ============================================================================
-- access_identities -- the generic Person/Identity representation this
-- entire domain is built around. See this file's header comment.
-- ============================================================================
create table public.access_identities (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  -- CAST | CREW | EXTERNAL -- which existing FilmSet record (if any) this identity wraps.
  person_category text not null,
  cast_member_id text references public.cast_members(id) on delete cascade,
  crew_member_id text references public.crew_members(id) on delete cascade,
  -- Populated only when person_category = 'EXTERNAL' -- no existing FilmSet person record to link to.
  display_name text,
  company text,
  photo_path text,
  -- Independent from person_category -- see header comment. A closed vocabulary today;
  -- CUSTOM exists as the documented escape hatch, not a free-text field.
  security_class text not null default 'CREW',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_identities_person_category_valid check (person_category in ('CAST', 'CREW', 'EXTERNAL')),
  constraint access_identities_source_matches_category check (
    (person_category = 'CAST' and cast_member_id is not null and crew_member_id is null)
    or (person_category = 'CREW' and crew_member_id is not null and cast_member_id is null)
    or (person_category = 'EXTERNAL' and cast_member_id is null and crew_member_id is null and display_name is not null)
  ),
  constraint access_identities_security_class_valid check (security_class in (
    'CREW', 'CAST', 'HOD', 'DIRECTOR_PRODUCER', 'BACKGROUND', 'DAY_PLAYER', 'VENDOR', 'CONTRACTOR',
    'VISITOR', 'MEDIA', 'SECURITY', 'DRIVER', 'VIP', 'TEMPORARY', 'LOCATION_STAFF', 'CUSTOM'
  )),
  constraint access_identities_id_production_unique unique (id, production_id)
);
create index access_identities_production_idx on public.access_identities (production_id);
create index access_identities_cast_member_idx on public.access_identities (cast_member_id);
create index access_identities_crew_member_idx on public.access_identities (crew_member_id);
-- One identity per underlying cast/crew record -- same "two partial unique indexes" technique
-- as dietary_profiles (0022), for the same reason (NULL <> NULL means a plain UNIQUE across the
-- pair wouldn't actually stop two CAST rows from colliding).
create unique index access_identities_one_per_cast_member on public.access_identities (production_id, cast_member_id) where person_category = 'CAST';
create unique index access_identities_one_per_crew_member on public.access_identities (production_id, crew_member_id) where person_category = 'CREW';

-- ============================================================================
-- access_credentials -- the credential domain. status is a real lifecycle,
-- never a boolean (owner's explicit instruction). No PII lives here.
-- ============================================================================
create table public.access_credentials (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  credential_type text not null default 'QR',
  credential_class text not null,
  -- Human-readable badge number (e.g. "VMPA-CR-000482") -- searchable by admins, NEVER the QR secret.
  credential_number text not null,
  -- The opaque, high-entropy value a QR actually encodes. Globally unique (a scanner resolves it
  -- without first knowing which production it belongs to).
  public_reference text not null,
  status text not null default 'DRAFT',
  assurance_level text not null default 'LEVEL_1_BASIC',
  valid_from timestamptz,
  valid_until timestamptz,
  issued_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revocation_reason text,
  replaced_by_credential_id text references public.access_credentials(id) on delete set null,
  -- Carefully constrained per the owner's instruction -- extensibility only, never a dumping
  -- ground for fields that should be real columns (e.g. never a secret/token value).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_credentials_type_valid check (credential_type in ('QR', 'BARCODE', 'NFC', 'SMART_CARD', 'MOBILE', 'BLE', 'PIN', 'EXTERNAL')),
  constraint access_credentials_class_valid check (credential_class in (
    'CREW', 'CAST', 'HOD', 'DIRECTOR_PRODUCER', 'BACKGROUND', 'DAY_PLAYER', 'VENDOR', 'CONTRACTOR',
    'VISITOR', 'MEDIA', 'SECURITY', 'DRIVER', 'VIP', 'TEMPORARY', 'LOCATION_STAFF', 'CUSTOM'
  )),
  constraint access_credentials_status_valid check (status in ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'LOST', 'REVOKED', 'EXPIRED', 'REPLACED')),
  constraint access_credentials_assurance_valid check (assurance_level in ('LEVEL_1_BASIC', 'LEVEL_2_VERIFIED', 'LEVEL_3_DYNAMIC', 'LEVEL_4_SMART', 'LEVEL_5_HIGH')),
  constraint access_credentials_validity_order check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint access_credentials_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_credentials_id_production_unique unique (id, production_id)
);
create index access_credentials_production_idx on public.access_credentials (production_id);
create index access_credentials_identity_idx on public.access_credentials (identity_id);
create index access_credentials_status_idx on public.access_credentials (status);
create unique index access_credentials_number_unique on public.access_credentials (production_id, credential_number);
create unique index access_credentials_public_reference_unique on public.access_credentials (public_reference);

-- ============================================================================
-- access_resources -- generic hierarchical resource/zone tree (owner's
-- explicit instruction: not hard-coded, arbitrary parent/child depth).
-- location_id optionally roots a resource tree at an existing FilmSet
-- Location (owner's spec §35) without duplicating it.
-- ============================================================================
create table public.access_resources (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  parent_resource_id text,
  location_id text references public.locations(id) on delete set null,
  resource_type text not null,
  name text not null,
  code text,
  description text,
  active boolean not null default true,
  -- This migration's own choice (the owner's spec names the field but not its vocabulary) --
  -- documented here rather than left as unconstrained free text.
  security_level text not null default 'STANDARD',
  minimum_assurance_level text not null default 'LEVEL_1_BASIC',
  capacity integer,
  occupancy_policy text not null default 'IGNORE',
  offline_policy text not null default 'DENY',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_resources_type_valid check (resource_type in (
    'SITE', 'LOCATION', 'ZONE', 'GATE', 'DOOR', 'ROOM', 'SET', 'STAGE', 'BASECAMP', 'HOLDING_AREA',
    'OFFICE', 'EQUIPMENT_AREA', 'VEHICLE_GATE', 'PARKING', 'CUSTOM'
  )),
  constraint access_resources_security_level_valid check (security_level in ('STANDARD', 'ELEVATED', 'RESTRICTED')),
  constraint access_resources_assurance_valid check (minimum_assurance_level in ('LEVEL_1_BASIC', 'LEVEL_2_VERIFIED', 'LEVEL_3_DYNAMIC', 'LEVEL_4_SMART', 'LEVEL_5_HIGH')),
  constraint access_resources_occupancy_policy_valid check (occupancy_policy in ('IGNORE', 'WARN', 'DENY')),
  constraint access_resources_offline_policy_valid check (offline_policy in ('DENY', 'ALLOW_CACHED', 'ALLOW_HIGH_ASSURANCE_CACHED')),
  constraint access_resources_capacity_non_negative check (capacity is null or capacity >= 0),
  constraint access_resources_parent_fk foreign key (parent_resource_id, production_id) references public.access_resources (id, production_id) on delete cascade,
  constraint access_resources_id_production_unique unique (id, production_id)
);
create index access_resources_production_idx on public.access_resources (production_id);
create index access_resources_parent_idx on public.access_resources (parent_resource_id);
create index access_resources_location_idx on public.access_resources (location_id);

-- ============================================================================
-- access_profiles / access_profile_rules / access_identity_profiles --
-- reusable, named access templates (owner's spec §9), assignable to many
-- identities instead of repeating the same rule set per person.
-- ============================================================================
create table public.access_profiles (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_profiles_id_production_unique unique (id, production_id),
  constraint access_profiles_production_name_unique unique (production_id, name)
);
create index access_profiles_production_idx on public.access_profiles (production_id);

/** One allowed-resource rule within a profile. Days/time window null = no restriction on that axis. */
create table public.access_profile_rules (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  profile_id text not null,
  resource_id text not null,
  days_of_week text[],
  time_start time,
  time_end time,
  -- Overrides the resource's own minimum only when stricter -- enforced by the policy engine, not this constraint.
  minimum_assurance_level text,
  escort_required boolean not null default false,
  created_at timestamptz not null default now(),
  constraint access_profile_rules_assurance_valid check (minimum_assurance_level is null or minimum_assurance_level in ('LEVEL_1_BASIC', 'LEVEL_2_VERIFIED', 'LEVEL_3_DYNAMIC', 'LEVEL_4_SMART', 'LEVEL_5_HIGH')),
  constraint access_profile_rules_time_order check (time_start is null or time_end is null or time_start <= time_end),
  constraint access_profile_rules_profile_fk foreign key (profile_id, production_id) references public.access_profiles (id, production_id) on delete cascade,
  constraint access_profile_rules_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete cascade
);
create index access_profile_rules_profile_idx on public.access_profile_rules (profile_id);
create index access_profile_rules_resource_idx on public.access_profile_rules (resource_id);

create table public.access_identity_profiles (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  profile_id text not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  constraint access_identity_profiles_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_identity_profiles_profile_fk foreign key (profile_id, production_id) references public.access_profiles (id, production_id) on delete cascade,
  constraint access_identity_profiles_unique unique (identity_id, profile_id)
);
create index access_identity_profiles_identity_idx on public.access_identity_profiles (identity_id);
create index access_identity_profiles_profile_idx on public.access_identity_profiles (profile_id);

-- ============================================================================
-- access_grants -- direct, individual resource overrides (owner's spec §9:
-- "Individual overrides must be possible").
-- ============================================================================
create table public.access_grants (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  resource_id text not null,
  valid_from timestamptz,
  valid_until timestamptz,
  days_of_week text[],
  time_start time,
  time_end time,
  granted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint access_grants_validity_order check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint access_grants_time_order check (time_start is null or time_end is null or time_start <= time_end),
  constraint access_grants_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_grants_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete cascade
);
create index access_grants_identity_idx on public.access_grants (identity_id);
create index access_grants_resource_idx on public.access_grants (resource_id);

-- ============================================================================
-- access_restrictions -- explicit blocks (owner's spec §31: "Restrictions
-- should override grants"). resource_id null = restricted from every
-- resource in the production, not just one.
-- ============================================================================
create table public.access_restrictions (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  resource_id text,
  reason text not null,
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint access_restrictions_validity_order check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint access_restrictions_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_restrictions_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete cascade
);
create index access_restrictions_identity_idx on public.access_restrictions (identity_id);
create index access_restrictions_resource_idx on public.access_restrictions (resource_id);

-- ============================================================================
-- access_checkpoints -- a physical gate/door/entrance where verification
-- actually happens.
-- ============================================================================
create table public.access_checkpoints (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  resource_id text not null,
  name text not null,
  code text,
  direction_mode text not null default 'BOTH',
  active boolean not null default true,
  anti_passback_mode text not null default 'OFF',
  requires_operator_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_checkpoints_direction_mode_valid check (direction_mode in ('ENTRY', 'EXIT', 'BOTH')),
  constraint access_checkpoints_anti_passback_mode_valid check (anti_passback_mode in ('OFF', 'WARN', 'DENY')),
  constraint access_checkpoints_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete cascade,
  constraint access_checkpoints_id_production_unique unique (id, production_id)
);
create index access_checkpoints_production_idx on public.access_checkpoints (production_id);
create index access_checkpoints_resource_idx on public.access_checkpoints (resource_id);

-- ============================================================================
-- access_devices -- every scanner is a first-class, individually trusted
-- security identity (owner's explicit instruction) -- device trust and
-- operator authentication are two separate axes, never conflated into one
-- shared "security login."
-- ============================================================================
create table public.access_devices (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  checkpoint_id text,
  name text not null,
  device_type text not null default 'MOBILE_SCANNER',
  device_identifier text not null,
  status text not null default 'PENDING',
  trusted_at timestamptz,
  trusted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  app_version text,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_devices_type_valid check (device_type in ('MOBILE_SCANNER', 'TABLET_SCANNER', 'FIXED_SCANNER', 'EDGE_GATEWAY', 'CONTROLLER', 'KIOSK', 'OTHER')),
  constraint access_devices_status_valid check (status in ('PENDING', 'TRUSTED', 'SUSPENDED', 'REVOKED')),
  constraint access_devices_checkpoint_fk foreign key (checkpoint_id, production_id) references public.access_checkpoints (id, production_id) on delete set null,
  constraint access_devices_id_production_unique unique (id, production_id)
);
create index access_devices_production_idx on public.access_devices (production_id);
create index access_devices_checkpoint_idx on public.access_devices (checkpoint_id);
create unique index access_devices_identifier_unique on public.access_devices (production_id, device_identifier);

-- ============================================================================
-- access_device_enrollments -- short-lived, one-time, HASHED enrollment
-- tokens backing secure scanner enrollment (owner's spec §14). The raw
-- token is never stored -- only its hash, generated and compared at the
-- application layer (this migration only shapes the table).
-- ============================================================================
create table public.access_device_enrollments (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  token_hash text not null,
  status text not null default 'PENDING',
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  consumed_by_device_id text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_device_enrollments_status_valid check (status in ('PENDING', 'CONSUMED', 'EXPIRED', 'REVOKED')),
  constraint access_device_enrollments_device_fk foreign key (consumed_by_device_id, production_id) references public.access_devices (id, production_id) on delete set null
);
create unique index access_device_enrollments_token_hash_unique on public.access_device_enrollments (token_hash);
create index access_device_enrollments_production_idx on public.access_device_enrollments (production_id);

-- ============================================================================
-- access_events -- the append-only verification ledger (owner's explicit
-- instruction: "ordinary operators cannot alter historical events"). No
-- Server Action writes here yet in this phase, so no INSERT policy exists
-- either -- see this file's header comment. When a later phase adds the
-- real scan-writing Server Action, that PR adds a narrowly-scoped INSERT
-- policy then, not a blanket one now.
-- ============================================================================
create table public.access_events (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text,
  credential_id text,
  device_id text not null,
  checkpoint_id text not null,
  resource_id text not null,
  operator_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  direction text,
  decision text not null,
  reason_code text not null,
  -- Compact snapshot of the policy/profile ids that produced this decision (owner's spec §49) --
  -- "for an event from yesterday, an administrator can answer why this person was allowed."
  policy_snapshot jsonb not null default '{}'::jsonb,
  verification_mode text not null default 'ONLINE',
  occurred_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  client_occurred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  constraint access_events_event_type_valid check (event_type in ('ACCESS_ATTEMPT', 'ENTRY', 'EXIT', 'OVERRIDE', 'MUSTER')),
  constraint access_events_direction_valid check (direction is null or direction in ('ENTRY', 'EXIT')),
  constraint access_events_decision_valid check (decision in ('ALLOW', 'DENY', 'WARN')),
  constraint access_events_verification_mode_valid check (verification_mode in ('ONLINE', 'OFFLINE_CACHED', 'MANUAL')),
  constraint access_events_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete set null,
  constraint access_events_credential_fk foreign key (credential_id, production_id) references public.access_credentials (id, production_id) on delete set null,
  constraint access_events_device_fk foreign key (device_id, production_id) references public.access_devices (id, production_id) on delete restrict,
  constraint access_events_checkpoint_fk foreign key (checkpoint_id, production_id) references public.access_checkpoints (id, production_id) on delete restrict,
  constraint access_events_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete restrict,
  constraint access_events_id_production_unique unique (id, production_id)
);
create index access_events_production_idx on public.access_events (production_id);
create index access_events_identity_idx on public.access_events (identity_id);
create index access_events_credential_idx on public.access_events (credential_id);
create index access_events_device_idx on public.access_events (device_id);
create index access_events_checkpoint_idx on public.access_events (checkpoint_id);
create index access_events_resource_idx on public.access_events (resource_id);
create index access_events_occurred_at_idx on public.access_events (occurred_at);
create index access_events_decision_idx on public.access_events (decision);
create index access_events_reason_code_idx on public.access_events (reason_code);

-- ============================================================================
-- access_temporary_grants -- time-boxed grants that stop applying on their
-- own after valid_until (owner's spec §30: "Approved grants automatically
-- stop applying... Use server time for validity" -- enforced by the policy
-- engine reading valid_until directly, not a cleanup job).
-- ============================================================================
create table public.access_temporary_grants (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  resource_id text not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  reason text,
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_temporary_grants_status_valid check (status in ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'REVOKED')),
  constraint access_temporary_grants_validity_order check (valid_from <= valid_until),
  constraint access_temporary_grants_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_temporary_grants_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete cascade
);
create index access_temporary_grants_identity_idx on public.access_temporary_grants (identity_id);
create index access_temporary_grants_resource_idx on public.access_temporary_grants (resource_id);
create index access_temporary_grants_status_idx on public.access_temporary_grants (status);

-- ============================================================================
-- access_visitor_details -- 1:1 extension of an EXTERNAL-category identity
-- with visitor-specific fields (owner's spec §28).
-- ============================================================================
create table public.access_visitor_details (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  identity_id text not null,
  host_identity_id text,
  purpose text,
  escort_required boolean not null default false,
  vehicle_info text,
  status text not null default 'PRE_REGISTERED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_visitor_details_status_valid check (status in ('PRE_REGISTERED', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED')),
  constraint access_visitor_details_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete cascade,
  constraint access_visitor_details_host_fk foreign key (host_identity_id, production_id) references public.access_identities (id, production_id) on delete set null,
  constraint access_visitor_details_identity_unique unique (identity_id)
);
create index access_visitor_details_identity_idx on public.access_visitor_details (identity_id);
create index access_visitor_details_host_idx on public.access_visitor_details (host_identity_id);
create index access_visitor_details_status_idx on public.access_visitor_details (status);

-- ============================================================================
-- access_incidents -- security incident management (owner's spec §32).
-- ============================================================================
create table public.access_incidents (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  incident_number text not null,
  category text not null,
  severity text not null default 'LOW',
  status text not null default 'OPEN',
  title text not null,
  description text,
  resource_id text,
  checkpoint_id text,
  identity_id text,
  credential_id text,
  access_event_id text,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint access_incidents_category_valid check (category in (
    'UNAUTHORIZED_ACCESS', 'BADGE_SHARING', 'LOST_CREDENTIAL', 'SUSPICIOUS_ACTIVITY', 'VEHICLE_ACCESS',
    'EQUIPMENT_AREA', 'VISITOR_ISSUE', 'SAFETY', 'DEVICE_ISSUE', 'OTHER'
  )),
  constraint access_incidents_severity_valid check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  constraint access_incidents_status_valid check (status in ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
  constraint access_incidents_resource_fk foreign key (resource_id, production_id) references public.access_resources (id, production_id) on delete set null,
  constraint access_incidents_checkpoint_fk foreign key (checkpoint_id, production_id) references public.access_checkpoints (id, production_id) on delete set null,
  constraint access_incidents_identity_fk foreign key (identity_id, production_id) references public.access_identities (id, production_id) on delete set null,
  constraint access_incidents_credential_fk foreign key (credential_id, production_id) references public.access_credentials (id, production_id) on delete set null,
  constraint access_incidents_access_event_fk foreign key (access_event_id, production_id) references public.access_events (id, production_id) on delete set null
);
create unique index access_incidents_number_unique on public.access_incidents (production_id, incident_number);
create index access_incidents_production_idx on public.access_incidents (production_id);
create index access_incidents_status_idx on public.access_incidents (status);
create index access_incidents_severity_idx on public.access_incidents (severity);

-- ============================================================================
-- RLS -- every table: enabled, membership-read-only. No write policy on
-- ANY table in this migration -- see this file's header comment. This is
-- the RLS backstop; real guard-facing minimal-field exposure is an
-- application/API-boundary concern for a later phase (owner's spec §42-43),
-- exactly matching how 0022's catering migration already documents this
-- same posture for its own sensitive tables.
-- ============================================================================
alter table public.access_identities enable row level security;
create policy "members read access_identities" on public.access_identities for select to authenticated using (public.is_production_member(production_id));

alter table public.access_credentials enable row level security;
create policy "members read access_credentials" on public.access_credentials for select to authenticated using (public.is_production_member(production_id));

alter table public.access_resources enable row level security;
create policy "members read access_resources" on public.access_resources for select to authenticated using (public.is_production_member(production_id));

alter table public.access_profiles enable row level security;
create policy "members read access_profiles" on public.access_profiles for select to authenticated using (public.is_production_member(production_id));

alter table public.access_profile_rules enable row level security;
create policy "members read access_profile_rules" on public.access_profile_rules for select to authenticated using (public.is_production_member(production_id));

alter table public.access_identity_profiles enable row level security;
create policy "members read access_identity_profiles" on public.access_identity_profiles for select to authenticated using (public.is_production_member(production_id));

alter table public.access_grants enable row level security;
create policy "members read access_grants" on public.access_grants for select to authenticated using (public.is_production_member(production_id));

alter table public.access_restrictions enable row level security;
create policy "members read access_restrictions" on public.access_restrictions for select to authenticated using (public.is_production_member(production_id));

alter table public.access_checkpoints enable row level security;
create policy "members read access_checkpoints" on public.access_checkpoints for select to authenticated using (public.is_production_member(production_id));

alter table public.access_devices enable row level security;
create policy "members read access_devices" on public.access_devices for select to authenticated using (public.is_production_member(production_id));

alter table public.access_device_enrollments enable row level security;
create policy "members read access_device_enrollments" on public.access_device_enrollments for select to authenticated using (public.is_production_member(production_id));

alter table public.access_events enable row level security;
create policy "members read access_events" on public.access_events for select to authenticated using (public.is_production_member(production_id));

alter table public.access_temporary_grants enable row level security;
create policy "members read access_temporary_grants" on public.access_temporary_grants for select to authenticated using (public.is_production_member(production_id));

alter table public.access_visitor_details enable row level security;
create policy "members read access_visitor_details" on public.access_visitor_details for select to authenticated using (public.is_production_member(production_id));

alter table public.access_incidents enable row level security;
create policy "members read access_incidents" on public.access_incidents for select to authenticated using (public.is_production_member(production_id));

-- ============================================================================
-- Deliberately NOT built in this migration (documented, not silently
-- dropped -- see docs/security/*_ACCESS_CONTROL.md for the full account):
-- - No INSERT/UPDATE/DELETE RLS policy anywhere in this file. Every write
--   path is designed but not yet mediated by a Server Action, so none is
--   opened yet -- matching 0017/0018's exact precedent.
-- - No Server Action, API route, QR generation/verification endpoint, or
--   UI page. Phase A is schema + policy-engine only.
-- - No facial recognition, biometric, NFC/OSDP hardware, or edge-gateway
--   tables -- explicitly out of scope (owner's spec §84), interfaces only
--   documented in docs/security/OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md.
-- - No security_musters table -- Phase F (owner's spec §64), after core
--   access/presence is stable.
-- - crew_members has no photo_path column (only cast_members and locations
--   do) -- a real, pre-existing gap this migration does not silently patch;
--   an EXTERNAL identity's own photo_path is this domain's only new photo
--   storage, reusing the existing production-photos Storage bucket pattern
--   (0011) in a later phase, not a new bucket.
-- ============================================================================

-- ============================================================================
-- END packages/db/migrations/0025_access_control_foundation.sql
-- ============================================================================

do $postcheck$
declare
  v_new_tables int;
  v_row_count int;
  v_rls_enabled_tables int;
  v_select_policy_tables int;
  v_write_policy_tables int;
begin
  select count(*) into v_new_tables
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'access_identities', 'access_credentials', 'access_resources', 'access_profiles',
      'access_profile_rules', 'access_identity_profiles', 'access_grants', 'access_restrictions',
      'access_checkpoints', 'access_devices', 'access_device_enrollments', 'access_events',
      'access_temporary_grants', 'access_visitor_details', 'access_incidents'
    );
  if v_new_tables <> 15 then
    raise exception 'INVARIANT FAILED: expected 15 new access_* tables, found %', v_new_tables;
  end if;

  select
    (select count(*) from public.access_identities) + (select count(*) from public.access_credentials) +
    (select count(*) from public.access_resources) + (select count(*) from public.access_profiles) +
    (select count(*) from public.access_profile_rules) + (select count(*) from public.access_identity_profiles) +
    (select count(*) from public.access_grants) + (select count(*) from public.access_restrictions) +
    (select count(*) from public.access_checkpoints) + (select count(*) from public.access_devices) +
    (select count(*) from public.access_device_enrollments) + (select count(*) from public.access_events) +
    (select count(*) from public.access_temporary_grants) + (select count(*) from public.access_visitor_details) +
    (select count(*) from public.access_incidents)
  into v_row_count;
  if v_row_count <> 0 then
    raise exception 'INVARIANT FAILED: every access_* table should be empty immediately after this migration, found % total rows across them', v_row_count;
  end if;

  select count(*) into v_rls_enabled_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'access_%'
    and c.relrowsecurity = true;
  if v_rls_enabled_tables <> 15 then
    raise exception 'INVARIANT FAILED: expected RLS enabled on all 15 access_* tables, found % with it enabled', v_rls_enabled_tables;
  end if;

  select count(distinct tablename) into v_select_policy_tables
  from pg_policies
  where schemaname = 'public'
    and tablename like 'access_%'
    and cmd = 'SELECT';
  if v_select_policy_tables <> 15 then
    raise exception 'INVARIANT FAILED: expected all 15 access_* tables to have exactly one SELECT policy, found % with one', v_select_policy_tables;
  end if;

  select count(*) into v_write_policy_tables
  from pg_policies
  where schemaname = 'public'
    and tablename like 'access_%'
    and cmd <> 'SELECT';
  if v_write_policy_tables <> 0 then
    raise exception 'INVARIANT FAILED: expected ZERO write (INSERT/UPDATE/DELETE/ALL) policies on any access_* table in this phase, found %', v_write_policy_tables;
  end if;

  raise notice 'ALL P16 CUTOVER INVARIANTS PASSED (0025) -- safe to commit.';
end $postcheck$;

commit;

```

# SCRIPT ENDS HERE
