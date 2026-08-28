-- ============================================================================
-- Contact & representation fields for Cast and Crew — until now neither
-- table had anywhere to put a phone number, an emergency contact, or an
-- actor's agent/manager, so there was no single place to share that
-- information with department heads (wardrobe, hair/makeup, camera) or
-- pull it onto a call sheet. Additive and nullable — existing rows are
-- unaffected.
-- ============================================================================
alter table public.cast_members
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists agent_name text,
  add column if not exists agent_phone text,
  add column if not exists agent_email text;

alter table public.crew_members
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists agent_name text,
  add column if not exists agent_phone text,
  add column if not exists agent_email text;
