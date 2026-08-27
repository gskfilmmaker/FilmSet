-- ============================================================================
-- Invite-by-email lookup — "read own profile" / "read co-member profiles"
-- correctly hide a stranger's profile row, but that also blocks the one
-- legitimate cross-tenant lookup the app needs: a Producer looking up a
-- not-yet-a-member invitee by email. A security definer function scoped to
-- "caller is a Producer of the production being invited to" gives that one
-- lookup without opening profiles to arbitrary authenticated reads.
-- ============================================================================
create or replace function public.find_profile_for_invite(p_production_id text, p_email text)
returns table(id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.email
  from public.profiles p
  where p.email = lower(p_email)
    and public.is_production_owner(p_production_id);
$$;

grant execute on function public.find_profile_for_invite(text, text) to authenticated;

-- ============================================================================
-- Join-table cross-production guard — the previous policies on prop_scenes,
-- scene_cast, and issue_scenes only checked that the caller belongs to the
-- scene's production. A caller who is a member of two productions could
-- still link a prop/cast member/issue from production B onto a scene in
-- production A. Require both linked rows to share the same production.
-- ============================================================================
drop policy if exists "members access prop_scenes" on public.prop_scenes;
create policy "members access prop_scenes" on public.prop_scenes for all
  to authenticated
  using (
    exists (
      select 1 from public.scenes s
      join public.props pr on pr.id = prop_scenes.prop_id and pr.production_id = s.production_id
      where s.id = prop_scenes.scene_id and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.scenes s
      join public.props pr on pr.id = prop_scenes.prop_id and pr.production_id = s.production_id
      where s.id = prop_scenes.scene_id and public.is_production_member(s.production_id)
    )
  );

drop policy if exists "members access scene_cast" on public.scene_cast;
create policy "members access scene_cast" on public.scene_cast for all
  to authenticated
  using (
    exists (
      select 1 from public.scenes s
      join public.cast_members cm on cm.id = scene_cast.cast_member_id and cm.production_id = s.production_id
      where s.id = scene_cast.scene_id and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.scenes s
      join public.cast_members cm on cm.id = scene_cast.cast_member_id and cm.production_id = s.production_id
      where s.id = scene_cast.scene_id and public.is_production_member(s.production_id)
    )
  );

drop policy if exists "members access issue_scenes" on public.issue_scenes;
create policy "members access issue_scenes" on public.issue_scenes for all
  to authenticated
  using (
    exists (
      select 1 from public.scenes s
      join public.issues i on i.id = issue_scenes.issue_id and i.production_id = s.production_id
      where s.id = issue_scenes.scene_id and public.is_production_member(s.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.scenes s
      join public.issues i on i.id = issue_scenes.issue_id and i.production_id = s.production_id
      where s.id = issue_scenes.scene_id and public.is_production_member(s.production_id)
    )
  );
