insert into storage.buckets (id, name, public)
values
  ('holerites', 'holerites', true),
  ('comprovantes', 'comprovantes', true)
on conflict (id) do update set public = excluded.public;

create policy "Authenticated users can upload salary documents"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('holerites', 'comprovantes'));

create policy "Authenticated users can update salary documents"
on storage.objects
for update
using (bucket_id in ('holerites', 'comprovantes'))
with check (bucket_id in ('holerites', 'comprovantes'));

create policy "Authenticated users can delete salary documents"
on storage.objects
for delete
to authenticated
using (bucket_id in ('holerites', 'comprovantes'));
