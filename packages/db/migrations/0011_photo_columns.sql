-- ============================================================================
-- Photo columns for Cast (headshots, for quick recognition once casting is
-- finalized) and Locations (set photos). Store the Storage object path, not
-- a URL — every read goes through a signed URL generated server-side (see
-- apps/web/lib/photo-storage.ts) since the production-photos bucket is
-- private. Additive and nullable — existing rows are unaffected.
-- ============================================================================
alter table public.cast_members
  add column if not exists photo_path text;

alter table public.locations
  add column if not exists photo_path text;
