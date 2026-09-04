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
