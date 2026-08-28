-- ============================================================================
-- Call sheet detail — Phase 11/12 of the industry-standard-call-sheet gap
-- analysis. Adds a radio/walkie channel per crew member (near-universal on
-- real call sheets, absent from ours) and richer per-cast-member call
-- entries: an AD status code, "On Call" in place of a fixed time, and the
-- department sub-calls (makeup/hair/wardrobe/pickup/rehearsal) that real
-- sheets show alongside a plain on-set call time.
-- ============================================================================
alter table public.crew_members
  add column if not exists walkie_channel text;

alter table public.shoot_day_cast_call_times
  add column if not exists status text,
  add column if not exists on_call boolean not null default false,
  add column if not exists pickup_time text,
  add column if not exists makeup_call_time text,
  add column if not exists hair_call_time text,
  add column if not exists wardrobe_call_time text,
  add column if not exists rehearsal_call_time text;
