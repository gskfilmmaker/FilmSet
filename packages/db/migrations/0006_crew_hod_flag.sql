-- ============================================================================
-- Head-of-department flag for Crew — Phase 2 of the production-office gap
-- analysis: crew was a flat list with no department hierarchy, so there was
-- no way to tell a department head apart from the rest of the department on
-- the Contact Sheet or anywhere else. Additive, defaults to false so
-- existing rows are unaffected.
-- ============================================================================
alter table public.crew_members
  add column if not exists is_hod boolean not null default false;
