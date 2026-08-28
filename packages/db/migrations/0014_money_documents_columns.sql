-- ============================================================================
-- Money & Documents — turning both from read-only placeholder pages into
-- real modules. Expenses become real invoices (date, invoice number,
-- attached file); Documents get a real attached file, an optional expiry,
-- and an optional link to the cast member/crew member/location they belong
-- to. Additive and nullable/defaulted throughout — existing rows are
-- unaffected.
-- ============================================================================
alter table public.expenses
  add column if not exists date text not null default '',
  add column if not exists invoice_number text,
  add column if not exists document_path text;

alter table public.documents
  add column if not exists file_path text,
  add column if not exists expiry_date text,
  add column if not exists linked_cast_member_id text references public.cast_members(id) on delete set null,
  add column if not exists linked_crew_member_id text references public.crew_members(id) on delete set null,
  add column if not exists linked_location_id text references public.locations(id) on delete set null;

-- budget_lines.actual is now derived from expenses per department (see
-- apps/web/app/money/actions.ts's recomputeActual) rather than hand-typed,
-- so each (production, department) pair needs exactly one row to upsert
-- into. A production created before this migration could already have
-- duplicate department rows from manual entry — this only adds the
-- constraint if none exist; if it fails, dedupe budget_lines by
-- (production_id, department) first, keeping the most recent row.
alter table public.budget_lines
  add constraint budget_lines_production_department_unique unique (production_id, department);
