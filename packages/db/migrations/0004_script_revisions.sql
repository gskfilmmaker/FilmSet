-- ============================================================================
-- Script revision tracking — the industry-standard colored-page convention
-- (White original, then Blue/Pink/Yellow/Green/Goldenrod/Buff/Salmon/Cherry,
-- cycling with a "2nd"/"3rd" prefix once exhausted). productions carries the
-- script's current overall color; scenes carries the color of the revision
-- that last actually changed that scene's content, so unrevised scenes stay
-- on whatever color they started at.
-- ============================================================================
alter table public.productions
  add column if not exists script_revision_color text not null default 'White';

alter table public.scenes
  add column if not exists revision_color text not null default 'White';
