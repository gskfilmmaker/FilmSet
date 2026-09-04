# Instructions — FilmSet P18 Live Supabase Cutover (0027)

**Read this whole file before doing anything.** This is a database migration against the **live production database**. Follow the steps below exactly, in order. Do not skip the safety checks. Do not run this against anything other than the intended production Supabase project.

## What this is

Adds the three columns the new Security & Access credential-badge feature needs: `productions.logo_path`, `productions.brand_color`, and `crew_members.photo_path`. Until this runs, the production-branding fields on the Settings page and crew photo upload will fail to save, and the credential badge will render without a production logo/brand color or a crew member's photo.

**This is purely additive: 3 new nullable columns, 1 new CHECK constraint, zero table changes.** No table is created, altered structurally, or dropped. No existing row anywhere is read, changed, or deleted by this script — every existing row simply gains these columns as `NULL`.

## What this adds

- `productions.logo_path` (text, nullable) — a Storage object path in the existing `production-photos` bucket, same convention as `cast_members.photo_path`. No new bucket, no new RLS: migration 0010's `storage.objects` policies already trust any path whose first segment is a production id the caller is a member of.
- `productions.brand_color` (text, nullable) — a `#RRGGBB` hex string, enforced by the new `productions_brand_color_format` CHECK constraint (`brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'`).
- `crew_members.photo_path` (text, nullable) — closes a pre-existing gap: `cast_members` and `locations` already had a `photo_path` (0011), `crew_members` never did.

## Before you run anything

1. **Confirm you are connected to the correct Supabase project.**
2. **Run this during low traffic** if convenient — though the risk is low (additive columns only, no existing data touched).
3. **Do not modify the SQL script below.**

## How to run it

1. Open the Supabase SQL Editor for the correct project.
2. Paste the **entire** SQL script below (between "SCRIPT BEGINS HERE" and "SCRIPT ENDS HERE") into a single query window.
3. Run it as one single execution — it's wrapped in `begin; ... commit;`.
4. Watch the output.

## What success looks like

Near the end of the output, a `NOTICE` line reading exactly:

```
ALL P18 CUTOVER INVARIANTS PASSED (0027) -- safe to commit.
```

followed by `COMMIT`. If you see this, the migration succeeded. **You do not need to do anything else.**

## What failure looks like, and what to do

If the base schema isn't live yet, or this script has already been run, it raises `PRE-FLIGHT ABORT:` naming exactly what didn't match, and Postgres automatically rolls back the entire transaction — nothing is left half-applied.

**Tested against real PostgreSQL 16**, in this order:

1. A full successful run against a scratch database with every prior migration (0000–0026) already applied — reached the exact success `NOTICE` and committed. Verified afterward via `information_schema.columns`: all 3 new columns exist, and the `productions_brand_color_format` constraint exists via `pg_constraint`.
2. A re-run of the exact same script against that now-migrated database — correctly aborts with `PRE-FLIGHT ABORT: public.productions.logo_path already exists...` and rolls back.
3. A run against a fresh, empty database (no prior migrations applied) — correctly aborts with `PRE-FLIGHT ABORT: public.productions not found...` and rolls back.
4. A functional check of the new CHECK constraint's regex directly: `'#1A2B3C'` matches (valid), `'not-a-color'`, `'#GGGGGG'` (non-hex characters), and `'#12345'` (too short) all correctly fail to match — confirming the constraint accepts only well-formed 6-digit hex colors.

If you get any exception:
- **Do not retry immediately. Do not edit the script and re-run it yourself.**
- Copy the exact error message and report it back.

## After a successful run

Reply with confirmation that you saw the exact success `NOTICE` message above. Nothing else needs to happen on the database side — the application code (production branding UI, crew photo upload, credential badge) is not deployed yet; merging that PR is a separate step the project owner controls.

---

# SCRIPT BEGINS HERE

```sql
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

```

# SCRIPT ENDS HERE
