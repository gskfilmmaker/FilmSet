-- ============================================================================
-- FilmSet -- P19 Cutover Script (0028)
-- Generated to accompany the ID-numbering-system PR (Security & Access
-- credential numbers, resource codes, checkpoint codes).
-- Applies migration 0028_id_numbering_system.sql against live Supabase.
--
-- This is purely additive: one new table (id_sequences, RLS-enabled with
-- 3 membership-scoped policies), one new nullable column + CHECK constraint
-- on productions, and two new partial unique indexes on existing columns
-- (access_resources.code, access_checkpoints.code). No existing table is
-- altered structurally beyond the one new column; no existing row anywhere
-- is read, changed, or deleted.
--
-- The pre-flight below confirms this script hasn't already been run before
-- touching anything.
--
-- If this reaches commit and prints the success notice, every invariant
-- held. If ANY check fails, Postgres has already rolled back the entire
-- transaction -- nothing is left half-applied.
-- ============================================================================

begin;

do $preflight$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'productions') then
    raise exception 'PRE-FLIGHT ABORT: public.productions not found -- this script depends on the base schema already being applied.';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'access_resources') then
    raise exception 'PRE-FLIGHT ABORT: public.access_resources not found -- this script depends on migration 0025 (Security & Access Phase A) already being applied.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'id_sequences') then
    raise exception 'PRE-FLIGHT ABORT: public.id_sequences already exists -- migration 0028 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: base schema is live, 0028 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0028_id_numbering_system.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P19 -- A real, auditable ID-numbering system for the identifiers this app
-- itself issues (credential numbers, resource codes, checkpoint codes), as
-- opposed to identifiers we merely capture from someone else's paperwork
-- (vendor invoice numbers, hotel room numbers, booking confirmation refs --
-- those stay free text, since auto-generating them would fight reality).
--
-- Format: {PRODUCTION-SHORT-CODE}-{ENTITY}-{sequence}, e.g. "VMPA-CR-000001".
--
-- 1. id_sequences -- one atomic counter per (production, entity_type).
--    Issuing a number is a single `insert ... on conflict do update
--    ... returning` statement (packages/db -- see apps/web/lib/id-registry.ts),
--    which Postgres executes atomically: no explicit row locking needed,
--    no risk of two concurrent issuances racing to the same number. Numbers
--    are never reused once issued, even if the row they were assigned to is
--    later deleted -- gaps in the sequence are normal and expected (a real
--    physical-badge-numbering SOP), not a bug.
-- 2. productions.short_code -- the producer-editable prefix (e.g. "VMPA").
--    Nullable: apps/web/lib/id-registry.ts derives a default from the
--    production's name (initials) whenever this is unset, so the feature
--    works with zero setup and can be overridden per production.
-- 3. Uniqueness on access_resources.code / access_checkpoints.code per
--    production -- these already existed as free-text optional fields
--    (0025) with no uniqueness guarantee; a numbering system is meaningless
--    without one. Partial index (code is not null) since both fields stay
--    optional -- a resource/checkpoint with no code is unaffected.
-- ============================================================================

create table public.id_sequences (
  production_id text not null references public.productions(id) on delete cascade,
  entity_type text not null,
  current_value integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (production_id, entity_type)
);

alter table public.id_sequences enable row level security;

-- Membership-scoped only, matching this migration train's established precedent
-- (0026's own header comment) -- the Producer-only write gate lives in the
-- app layer (apps/web/lib/id-registry.ts is only ever called from actions
-- already behind requireProductionMember(productionId, ["Producer"])).
create policy "members read id_sequences" on public.id_sequences for select
  to authenticated using (public.is_production_member(production_id));
create policy "members write id_sequences" on public.id_sequences for insert
  to authenticated with check (public.is_production_member(production_id));
create policy "members update id_sequences" on public.id_sequences for update
  to authenticated using (public.is_production_member(production_id)) with check (public.is_production_member(production_id));
-- No delete policy: a production's counters are never removed while the
-- production exists, and cascade-delete on the production row handles the rest.

alter table public.productions
  add column if not exists short_code text;
alter table public.productions
  add constraint productions_short_code_format check (short_code is null or short_code ~ '^[A-Z0-9]{2,8}$');

create unique index if not exists access_resources_code_unique
  on public.access_resources (production_id, code) where code is not null;
create unique index if not exists access_checkpoints_code_unique
  on public.access_checkpoints (production_id, code) where code is not null;

-- ============================================================================
-- END packages/db/migrations/0028_id_numbering_system.sql
-- ============================================================================

do $postcheck$
declare
  v_id_sequences_policies int;
  v_short_code_column boolean;
  v_short_code_constraint boolean;
  v_resource_index boolean;
  v_checkpoint_index boolean;
begin
  select count(*) into v_id_sequences_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'id_sequences' and cmd in ('SELECT', 'INSERT', 'UPDATE');
  if v_id_sequences_policies <> 3 then
    raise exception 'INVARIANT FAILED: expected id_sequences to have exactly SELECT+INSERT+UPDATE policies (no DELETE), found %', v_id_sequences_policies;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'id_sequences' and cmd = 'DELETE') then
    raise exception 'INVARIANT FAILED: id_sequences should NOT have a DELETE policy -- counters are never removed while their production exists.';
  end if;

  select exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'productions' and column_name = 'short_code'
  ) into v_short_code_column;
  if not v_short_code_column then
    raise exception 'INVARIANT FAILED: expected column productions.short_code to exist.';
  end if;

  select exists (
    select 1 from pg_constraint where conname = 'productions_short_code_format'
  ) into v_short_code_constraint;
  if not v_short_code_constraint then
    raise exception 'INVARIANT FAILED: expected constraint productions_short_code_format to exist.';
  end if;

  select exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'access_resources_code_unique'
  ) into v_resource_index;
  if not v_resource_index then
    raise exception 'INVARIANT FAILED: expected index access_resources_code_unique to exist.';
  end if;

  select exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'access_checkpoints_code_unique'
  ) into v_checkpoint_index;
  if not v_checkpoint_index then
    raise exception 'INVARIANT FAILED: expected index access_checkpoints_code_unique to exist.';
  end if;

  raise notice 'ALL P19 CUTOVER INVARIANTS PASSED (0028) -- safe to commit.';
end $postcheck$;

commit;
