-- Notice board ("Duyurular"): replaces the carpool board with general "I have / I'm looking for"
-- posts (transport, gear, flying buddy, training, lost & found, other). Adults only, like rides:
-- person-to-person arrangements stay out of reach of minors. Posts close themselves after
-- 30 days unless the owner renews them. The rides table stays for now (legacy, no new UI).

create type public.notice_kind as enum ('offer', 'request');
create type public.notice_category as enum
  ('transport', 'gear', 'buddy', 'training', 'lost_found', 'other');

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notice_kind not null,
  category public.notice_category not null,
  title text not null check (char_length(title) between 3 and 120),
  body text check (char_length(body) <= 2000),
  site_id uuid references public.sites (id) on delete set null,
  place_text text check (char_length(place_text) <= 120),
  notice_date date,
  seats smallint check (seats between 1 and 8),
  price numeric(10, 2) check (price >= 0),
  currency text check (currency in ('TRY', 'EUR', 'USD')),
  photo_path text check (char_length(photo_path) <= 300),
  closed boolean not null default false,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index notices_open_idx on public.notices (expires_at) where not closed;
create index notices_user_idx on public.notices (user_id);
alter table public.notices enable row level security;

revoke insert, update on public.notices from anon, authenticated;
grant insert (user_id, kind, category, title, body, site_id, place_text, notice_date, seats, price,
  currency, photo_path) on public.notices to authenticated;
grant update (kind, category, title, body, site_id, place_text, notice_date, seats, price, currency,
  photo_path, closed, expires_at) on public.notices to authenticated;

create policy "notices: adults read" on public.notices
  for select to authenticated using (private.can_use_rides() or private.is_moderator());
create policy "notices: adults post" on public.notices
  for insert to authenticated
  with check (user_id = auth.uid() and private.can_use_rides()
    and (photo_path is null or photo_path like auth.uid()::text || '/%'));
-- Renewing is allowed, but never more than 30 days ahead.
create policy "notices: owner edits" on public.notices
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.can_use_rides()
    and expires_at <= now() + interval '30 days 1 minute'
    and (photo_path is null or photo_path like auth.uid()::text || '/%'));
create policy "notices: owner or moderator deletes" on public.notices
  for delete to authenticated using (user_id = auth.uid() or private.is_moderator());

alter type public.report_target add value if not exists 'notice';

create trigger notices_activity after insert on public.notices
  for each row execute function private.log_activity('notice.posted', 'user_id', 'id');

-- Photos: private bucket, readable by the same people who can read the board.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notice-photos', 'notice-photos', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "notice-photos: board readers read" on storage.objects
  for select to authenticated
  using (bucket_id = 'notice-photos' and (private.can_use_rides() or private.is_moderator()));
create policy "notice-photos: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notice-photos' and private.can_use_rides()
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy "notice-photos: owner deletes own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notice-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Carry over upcoming carpool posts so nothing disappears with the old page.
insert into public.notices (user_id, kind, category, title, body, site_id, place_text, notice_date,
  seats, closed, created_at)
select r.user_id, r.kind::text::public.notice_kind, 'transport',
  left(r.from_text || coalesce(' → ' || nullif(r.to_text, ''), ' →'), 120),
  r.note, r.site_id, r.to_text, r.ride_date, r.seats, r.closed, r.created_at
from public.rides r
where r.ride_date >= current_date;

insert into public.retention_policies (data_type, retain_days, description) values
  ('notices', 30, 'Notice board posts are deleted this many days after they expire.')
on conflict (data_type) do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-old-notices', '50 3 * * *', $job$
      delete from public.notices n
      using public.retention_policies p
      where p.data_type = 'notices'
        and n.expires_at < now() - make_interval(days => coalesce(p.retain_days, 30))
    $job$);
  end if;
end $$;
