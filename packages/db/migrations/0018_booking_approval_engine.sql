-- ============================================================================
-- P5 — Booking + Approval Engine. See docs/audits/LOGISTICS_DOMAIN_MODEL.md
-- §0.1-0.3 and docs/audits/LOGISTICS_IMPLEMENTATION_READINESS.md §4-5 for
-- the full design and the reasoning behind building this before any
-- Logistics subdomain (Travel, Accommodation, Transportation, Catering —
-- none of which exist as schema yet).
--
-- Scope, deliberately: schema only. Nothing in this migration changes any
-- existing screen, Server Action, or table's behavior. No Server Action
-- anywhere in apps/web reads or writes any table created here — that is
-- separate, future, explicitly-authorized work, exactly like P1b's
-- authorization foundation was before its own wiring plan.
-- ============================================================================

-- ============================================================================
-- bookings — the shared substrate every Logistics subdomain attaches to via
-- subject_type/subject_id rather than each reimplementing its own
-- lifecycle. Both columns stay null until the first subdomain lands.
-- ============================================================================
create table public.bookings (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  type text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  department_id text references public.departments(id) on delete set null,
  subject_type text,
  subject_id text,
  vendor_ref text,
  cost numeric(12, 2),
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_production_idx on public.bookings (production_id);
create index bookings_department_idx on public.bookings (department_id);

create table public.booking_quotes (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  vendor_ref text not null,
  cost numeric(12, 2) not null,
  currency text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index booking_quotes_booking_idx on public.booking_quotes (booking_id);

create table public.booking_confirmations (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  confirmation_ref text not null,
  confirmed_at timestamptz not null default now()
);
create index booking_confirmations_booking_idx on public.booking_confirmations (booking_id);

create table public.booking_changes (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  change_type text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index booking_changes_booking_idx on public.booking_changes (booking_id);

create table public.booking_cancellations (
  booking_id text primary key references public.bookings(id) on delete cascade,
  reason text not null,
  refund_state text,
  cancelled_at timestamptz not null default now()
);

-- ============================================================================
-- Approval Engine — no module gets a hard-coded approval `if` chain; a new
-- booking type reuses this with a different stage list, not new code.
-- ============================================================================
create table public.approval_workflows (
  id text primary key,
  production_id text not null references public.productions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index approval_workflows_production_idx on public.approval_workflows (production_id);

create table public.approval_stages (
  id text primary key,
  workflow_id text not null references public.approval_workflows(id) on delete cascade,
  "order" integer not null,
  required_permission text not null references public.permissions(key) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workflow_id, "order")
);
create index approval_stages_workflow_idx on public.approval_stages (workflow_id);

create table public.approval_rules (
  id text primary key,
  stage_id text not null references public.approval_stages(id) on delete cascade,
  condition_type text not null,
  condition_value text not null
);
create index approval_rules_stage_idx on public.approval_rules (stage_id);

create table public.approval_requests (
  id text primary key,
  workflow_id text not null references public.approval_workflows(id) on delete restrict,
  booking_id text not null references public.bookings(id) on delete cascade,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index approval_requests_booking_idx on public.approval_requests (booking_id);
create index approval_requests_workflow_idx on public.approval_requests (workflow_id);

-- Doubles as LOGISTICS_DOMAIN_MODEL.md §0.1's BookingApproval: a booking's
-- approval history is its approval_requests joined to their
-- approval_decisions, not a separate, duplicate record.
create table public.approval_decisions (
  id text primary key,
  request_id text not null references public.approval_requests(id) on delete cascade,
  stage_id text not null references public.approval_stages(id) on delete restrict,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decision text not null,
  note text,
  decided_at timestamptz not null default now()
);
create index approval_decisions_request_idx on public.approval_decisions (request_id);

-- ============================================================================
-- Logistics ↔ Finance (§0.3): Booking → Commitment → Invoice → Actual.
-- `expenses.booking_id` (added below) is the Actual stage — today's real
-- table, not a new one, per the domain model's explicit "no vendor/cost
-- data duplicated between Money and Logistics" requirement.
-- ============================================================================
create table public.commitments (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null,
  budget_line_id text references public.budget_lines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index commitments_booking_idx on public.commitments (booking_id);
create index commitments_budget_line_idx on public.commitments (budget_line_id);

create table public.invoices (
  id text primary key,
  commitment_id text not null references public.commitments(id) on delete cascade,
  vendor_ref text not null,
  amount numeric(12, 2) not null,
  invoice_number text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index invoices_commitment_idx on public.invoices (commitment_id);

alter table public.expenses add column booking_id text references public.bookings(id) on delete set null;

-- ============================================================================
-- RLS — same posture as P1b (0017_authorization_foundation.sql): read
-- access follows production membership; every table's write access
-- (insert/update/delete) is left DENIED by default (RLS enabled, no
-- policy for those operations), since no Server Action writes to any of
-- these tables yet.
-- ============================================================================
alter table public.bookings enable row level security;
create policy "production members read bookings" on public.bookings for select
  to authenticated
  using (public.is_production_member(production_id));

alter table public.booking_quotes enable row level security;
create policy "production members read booking quotes" on public.booking_quotes for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_quotes.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_confirmations enable row level security;
create policy "production members read booking confirmations" on public.booking_confirmations for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_confirmations.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_changes enable row level security;
create policy "production members read booking changes" on public.booking_changes for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_changes.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.booking_cancellations enable row level security;
create policy "production members read booking cancellations" on public.booking_cancellations for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_cancellations.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.approval_workflows enable row level security;
create policy "production members read approval workflows" on public.approval_workflows for select
  to authenticated
  using (public.is_production_member(production_id));

alter table public.approval_stages enable row level security;
create policy "production members read approval stages" on public.approval_stages for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_workflows w
      where w.id = approval_stages.workflow_id
        and public.is_production_member(w.production_id)
    )
  );

alter table public.approval_rules enable row level security;
create policy "production members read approval rules" on public.approval_rules for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_stages s
      join public.approval_workflows w on w.id = s.workflow_id
      where s.id = approval_rules.stage_id
        and public.is_production_member(w.production_id)
    )
  );

alter table public.approval_requests enable row level security;
create policy "production members read approval requests" on public.approval_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = approval_requests.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.approval_decisions enable row level security;
create policy "production members read approval decisions" on public.approval_decisions for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      join public.bookings b on b.id = r.booking_id
      where r.id = approval_decisions.request_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.commitments enable row level security;
create policy "production members read commitments" on public.commitments for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = commitments.booking_id
        and public.is_production_member(b.production_id)
    )
  );

alter table public.invoices enable row level security;
create policy "production members read invoices" on public.invoices for select
  to authenticated
  using (
    exists (
      select 1 from public.commitments c
      join public.bookings b on b.id = c.booking_id
      where c.id = invoices.commitment_id
        and public.is_production_member(b.production_id)
    )
  );

-- ============================================================================
-- Deliberately NOT changed by this migration:
-- - No Logistics subdomain table (Travel/Accommodation/Transportation/
--   Catering) is created — still design-only per LOGISTICS_DOMAIN_MODEL.md
--   §1-3,6. bookings.subject_type/subject_id have nothing to point at yet.
-- - Every existing table's RLS policy, including expenses' — none are
--   modified. The new expenses.booking_id column is nullable and
--   unindexed-by-default-query-path, so existing Money queries are
--   unaffected.
-- - No Server Action anywhere in apps/web reads or writes any table
--   created by this migration.
-- ============================================================================
