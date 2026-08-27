-- ============================================================================
-- Active production preference — backs the project switcher. Nullable and
-- set null on delete: a stale/missing value just means "pick any
-- membership," handled in app code (apps/web/lib/authz.ts), not a
-- constraint violation.
-- ============================================================================
alter table public.profiles
  add column if not exists active_production_id text references public.productions(id) on delete set null;

-- No new RLS policy needed: "update own profile" (id = auth.uid()) already
-- lets a user set their own active_production_id. requireCurrentProduction
-- re-validates the stored value is a production the user still belongs to
-- before trusting it, so a stale or foreign id here can't grant access to
-- data the membership-based policies wouldn't already allow.
