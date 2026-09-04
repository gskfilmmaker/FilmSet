-- ============================================================================
-- FilmSet -- P18 Cutover Script (0027)
-- Generated to accompany the Security & Access credential-badge PR.
-- Applies migration 0027_production_branding_and_crew_photo.sql against
-- live Supabase.
--
-- This is purely additive: three new nullable columns (productions.logo_path,
-- productions.brand_color, crew_members.photo_path) plus one CHECK
-- constraint validating brand_color's format. No table is created or
-- dropped, no existing column is altered or removed, no existing row
-- anywhere is touched -- every existing row simply gets these new columns
-- as NULL.
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

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crew_members') then
    raise exception 'PRE-FLIGHT ABORT: public.crew_members not found -- this script depends on the base schema already being applied.';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'productions' and column_name = 'logo_path') then
    raise exception 'PRE-FLIGHT ABORT: public.productions.logo_path already exists -- migration 0027 appears to already be live. Not safe to run this script again.';
  end if;

  raise notice 'Pre-flight checks passed: base schema is live, 0027 is not yet applied. Proceeding.';
end $preflight$;

-- ============================================================================
-- BEGIN packages/db/migrations/0027_production_branding_and_crew_photo.sql (pasted verbatim, unmodified)
-- ============================================================================

-- ============================================================================
-- P18 -- Two small, independent, purely-additive columns needed for the
-- Security & Access credential badge (docs/security/QR_SECURITY_ACCESS_CONTROL.md):
--
-- 1. productions.logo_path / brand_color -- a production has no branding
--    fields today. A badge needs to show the production's own logo and
--    accent color, not FilmSet's -- these are the source for that.
--    logo_path follows the exact same convention as cast_members.photo_path
--    / locations.photo_path (0011): a Storage object path in the existing
--    production-photos bucket, never a public URL, resolved server-side
--    via a signed URL (apps/web/lib/photo-storage.ts). No new bucket, no
--    new RLS -- 0010's storage.objects policies already trust any path
--    whose first segment is a production_id the caller is a member of,
--    regardless of the second segment, so a new "production" entity-type
--    path (production_id}/production/{production_id}/...) needs nothing
--    further granted.
-- 2. crew_members.photo_path -- cast_members and locations already have a
--    photo_path (0011); crew_members never got one. A real, pre-existing
--    gap (documented in 0025's own header comment) -- this migration
--    closes it so a crew member's credential badge can show a photo the
--    same way a cast member's already can.
--
-- Both nullable, no default requirement -- existing rows are unaffected.
-- ============================================================================
alter table public.productions
  add column if not exists logo_path text;

alter table public.productions
  add column if not exists brand_color text;
alter table public.productions
  add constraint productions_brand_color_format check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.crew_members
  add column if not exists photo_path text;

-- ============================================================================
-- END packages/db/migrations/0027_production_branding_and_crew_photo.sql
-- ============================================================================

do $postcheck$
declare
  v_new_columns int;
  v_constraint_exists boolean;
begin
  select count(*) into v_new_columns
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'productions' and column_name in ('logo_path', 'brand_color'))
      or (table_name = 'crew_members' and column_name = 'photo_path'));
  if v_new_columns <> 3 then
    raise exception 'INVARIANT FAILED: expected 3 new columns (productions.logo_path, productions.brand_color, crew_members.photo_path), found %', v_new_columns;
  end if;

  select exists (
    select 1 from pg_constraint where conname = 'productions_brand_color_format'
  ) into v_constraint_exists;
  if not v_constraint_exists then
    raise exception 'INVARIANT FAILED: expected constraint productions_brand_color_format to exist.';
  end if;

  raise notice 'ALL P18 CUTOVER INVARIANTS PASSED (0027) -- safe to commit.';
end $postcheck$;

commit;
