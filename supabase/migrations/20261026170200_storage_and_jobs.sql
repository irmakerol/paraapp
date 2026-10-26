-- Storage buckets and scheduled jobs for Phase 0.

-- Avatars are private: the app reads them through signed URLs, and a viewer may only
-- sign a photo that profile_cards shows them (so per-field photo privacy is enforced).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "avatars: owner manages own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: visible photos" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'avatars'
    and exists (select 1 from public.profile_cards c where c.avatar_path = storage.objects.name)
  );

-- Scheduled jobs. pg_cron is available on Supabase (local and hosted); the guard keeps
-- plain-Postgres test runs working without it.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-deleted-accounts', '15 3 * * *',
      'select private.purge_deleted_accounts()');
    perform cron.schedule('promote-adults', '20 3 * * *',
      'select private.promote_adults()');
    perform cron.schedule('expire-guardian-requests', '25 3 * * *', $job$
      delete from public.guardian_consents g
      using public.retention_policies r
      where r.data_type = 'guardian_requests'
        and g.confirmed_at is null
        and g.expires_at < now() - make_interval(days => coalesce(r.retain_days, 30))
    $job$);
    perform cron.schedule('trim-audit-log', '30 3 * * *', $job$
      delete from public.audit_log a
      using public.retention_policies r
      where r.data_type = 'audit_log' and r.retain_days is not null
        and a.created_at < now() - make_interval(days => r.retain_days)
    $job$);
  else
    raise notice 'pg_cron not available; scheduled jobs not created';
  end if;
end $$;
