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
