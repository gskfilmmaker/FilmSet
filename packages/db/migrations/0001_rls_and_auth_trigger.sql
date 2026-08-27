-- ============================================================================
-- Profile auto-creation
-- ============================================================================
-- Every Supabase Auth user gets a matching public.profiles row the moment
-- they sign up. security definer + a fixed search_path so the function runs
-- with the privileges (and RLS-bypass, as table owner) of whoever created
-- it, regardless of who triggers it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Grants — the app always connects as `authenticated` for real requests
-- (see packages/db/src/client.ts runAsUser). Statement-level privileges
-- live here; row-level restriction is the policies below. `anon` gets
-- nothing, so an unauthenticated request can't read or write anything.
-- ============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Any table a future migration adds automatically gets the same grants.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

-- ============================================================================
-- Helper predicates — security definer so they bypass RLS internally
-- (avoids infinite recursion when a production_members policy itself calls
-- one of these, which also queries production_members).
-- ============================================================================
create or replace function public.is_production_member(target_production_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_production_owner(target_production_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
      and pm.role = 'Producer'
  );
$$;

grant execute on function public.is_production_member(text) to authenticated;
grant execute on function public.is_production_owner(text) to authenticated;

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "read co-member profiles" on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.production_members mine
      join public.production_members theirs on theirs.production_id = mine.production_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "update own profile" on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================================
-- productions — select as any member; insert only for yourself; update/
-- delete restricted to Producers (the "owner" role).
-- ============================================================================
alter table public.productions enable row level security;

create policy "select productions as member" on public.productions for select
  to authenticated
  using (public.is_production_member(id));

create policy "insert own production" on public.productions for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "update productions as owner" on public.productions for update
  to authenticated
  using (public.is_production_owner(id))
  with check (public.is_production_owner(id));

create policy "delete productions as owner" on public.productions for delete
  to authenticated
  using (public.is_production_owner(id));

-- ============================================================================
-- production_members — the membership table itself. Anyone can see their
-- own row (so "which productions am I in" works); members can see their
-- production's roster; only Producers can add/change/remove OTHER members
-- (a user can always remove themselves).
-- ============================================================================
alter table public.production_members enable row level security;

create policy "select memberships as member" on public.production_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_production_member(production_id));

create policy "insert own membership or owner adds member" on public.production_members for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_production_owner(production_id));

create policy "update memberships as owner" on public.production_members for update
  to authenticated
  using (public.is_production_owner(production_id))
  with check (public.is_production_owner(production_id));

create policy "delete memberships as owner or self" on public.production_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_production_owner(production_id));

-- ============================================================================
-- Production-scoped tables with a direct production_id column — uniform
-- "any member can read/write" policy. Role-level write restrictions beyond
-- membership (e.g. only a Producer can delete a whole production) are
-- enforced at the app layer (apps/web/lib/authz.ts) where the specific
-- action warrants it, not here.
-- ============================================================================
alter table public.characters enable row level security;
create policy "members access characters" on public.characters for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.cast_members enable row level security;
create policy "members access cast_members" on public.cast_members for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.crew_members enable row level security;
create policy "members access crew_members" on public.crew_members for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.locations enable row level security;
create policy "members access locations" on public.locations for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.props enable row level security;
create policy "members access props" on public.props for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.shoot_days enable row level security;
create policy "members access shoot_days" on public.shoot_days for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.scenes enable row level security;
create policy "members access scenes" on public.scenes for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.breakdown_elements enable row level security;
create policy "members access breakdown_elements" on public.breakdown_elements for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.script_pages enable row level security;
create policy "members access script_pages" on public.script_pages for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.issues enable row level security;
create policy "members access issues" on public.issues for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.approvals enable row level security;
create policy "members access approvals" on public.approvals for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.documents enable row level security;
create policy "members access documents" on public.documents for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.expenses enable row level security;
create policy "members access expenses" on public.expenses for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.budget_lines enable row level security;
create policy "members access budget_lines" on public.budget_lines for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.activities enable row level security;
create policy "members access activities" on public.activities for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.call_sheets enable row level security;
create policy "members access call_sheets" on public.call_sheets for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.ai_recommendations enable row level security;
create policy "members access ai_recommendations" on public.ai_recommendations for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

alter table public.ai_suggestion_log enable row level security;
create policy "members access ai_suggestion_log" on public.ai_suggestion_log for all
  to authenticated
  using (public.is_production_member(production_id))
  with check (public.is_production_member(production_id));

-- ============================================================================
-- Join tables with no direct production_id — check membership through the
-- row they attach to.
-- ============================================================================
alter table public.prop_scenes enable row level security;
create policy "members access prop_scenes" on public.prop_scenes for all
  to authenticated
  using (exists (select 1 from public.scenes s where s.id = prop_scenes.scene_id and public.is_production_member(s.production_id)))
  with check (exists (select 1 from public.scenes s where s.id = prop_scenes.scene_id and public.is_production_member(s.production_id)));

alter table public.scene_cast enable row level security;
create policy "members access scene_cast" on public.scene_cast for all
  to authenticated
  using (exists (select 1 from public.scenes s where s.id = scene_cast.scene_id and public.is_production_member(s.production_id)))
  with check (exists (select 1 from public.scenes s where s.id = scene_cast.scene_id and public.is_production_member(s.production_id)));

alter table public.issue_scenes enable row level security;
create policy "members access issue_scenes" on public.issue_scenes for all
  to authenticated
  using (exists (select 1 from public.scenes s where s.id = issue_scenes.scene_id and public.is_production_member(s.production_id)))
  with check (exists (select 1 from public.scenes s where s.id = issue_scenes.scene_id and public.is_production_member(s.production_id)));

alter table public.call_sheet_timeline_events enable row level security;
create policy "members access call_sheet_timeline_events" on public.call_sheet_timeline_events for all
  to authenticated
  using (exists (select 1 from public.shoot_days d where d.id = call_sheet_timeline_events.shoot_day_id and public.is_production_member(d.production_id)))
  with check (exists (select 1 from public.shoot_days d where d.id = call_sheet_timeline_events.shoot_day_id and public.is_production_member(d.production_id)));
