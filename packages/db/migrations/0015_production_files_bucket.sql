-- ============================================================================
-- Private Storage bucket for invoice/receipt attachments (Money) and
-- uploaded documents (Documents). Separate from production-photos (0010)
-- since these are general files (PDFs, office docs), not just images. Same
-- RLS pattern: path convention {production_id}/{expense|document}/{entity_id}/
-- {filename}, trusting only the first path segment against
-- public.is_production_member(text) (see migration 0001).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('production-files', 'production-files', false)
on conflict (id) do nothing;

create policy "members read production files" on storage.objects for select
  to authenticated
  using (bucket_id = 'production-files' and public.is_production_member((storage.foldername(name))[1]));

create policy "members upload production files" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'production-files' and public.is_production_member((storage.foldername(name))[1]));

create policy "members update production files" on storage.objects for update
  to authenticated
  using (bucket_id = 'production-files' and public.is_production_member((storage.foldername(name))[1]))
  with check (bucket_id = 'production-files' and public.is_production_member((storage.foldername(name))[1]));

create policy "members delete production files" on storage.objects for delete
  to authenticated
  using (bucket_id = 'production-files' and public.is_production_member((storage.foldername(name))[1]));
