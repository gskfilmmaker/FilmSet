-- ============================================================================
-- Deal memo / contract status for Crew — Phase 5 of the production-office
-- gap analysis. Cast already tracked Signed/Pending/Missing contract
-- status; Crew had no compliance tracking at all. Extends the same
-- tracking to crew_members, defaulting existing rows to 'Pending' so
-- nothing silently reads as compliant.
-- ============================================================================
alter table public.crew_members
  add column if not exists contract text not null default 'Pending';
