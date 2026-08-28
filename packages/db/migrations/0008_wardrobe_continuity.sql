-- ============================================================================
-- Wardrobe/hair/makeup workflow — Phase 4 of the production-office gap
-- analysis. Cast had nowhere to record sizing (for wardrobe pulls and
-- fittings), and scenes had nowhere to note continuity (a torn sleeve, a
-- bruise, wet hair) that wardrobe/hair/makeup need to see per scene.
-- Additive: sizing columns are nullable, continuity_notes defaults to "".
-- ============================================================================
alter table public.cast_members
  add column if not exists height text,
  add column if not exists shirt_size text,
  add column if not exists pant_size text,
  add column if not exists shoe_size text,
  add column if not exists sizing_notes text;

alter table public.scenes
  add column if not exists continuity_notes text not null default '';
