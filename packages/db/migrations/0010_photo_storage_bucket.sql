-- ============================================================================
-- Private Storage bucket for Cast headshots and Location/set photos. Not
-- public — every read/write is gated by production membership, matching how
-- every other table in this app is scoped. Path convention enforced by app
-- code: {production_id}/{cast|location}/{entity_id}/{filename}. The RLS
-- policies below trust only the first path segment (the production id),
-- checked against the same public.is_production_member(text) used
-- throughout the rest of the schema (see migration 0001).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('production-photos', 'production-photos', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "members read production photos" on storage.objects for select
  to authenticated
  using (bucket_id = 'production-photos' and public.is_production_member((storage.foldername(name))[1]));

create policy "members upload production photos" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'production-photos' and public.is_production_member((storage.foldername(name))[1]));

create policy "members update production photos" on storage.objects for update
  to authenticated
  using (bucket_id = 'production-photos' and public.is_production_member((storage.foldername(name))[1]))
  with check (bucket_id = 'production-photos' and public.is_production_member((storage.foldername(name))[1]));

create policy "members delete production photos" on storage.objects for delete
  to authenticated
  using (bucket_id = 'production-photos' and public.is_production_member((storage.foldername(name))[1]));
