-- Activity log for admins (Irmak, 2026-10-30): when someone was last online and what they did in
-- the app (visits, flights added, listings, RSVPs, trip registrations, comments, rides). No
-- message contents and no positions. Kept 90 days; the person can see their own log.

alter table public.profiles add column last_seen_at timestamptz;
-- Not user-writable: only touch_last_seen() sets it.

create table public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index user_activity_user_idx on public.user_activity (user_id, created_at desc);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon;
revoke insert, update, delete on public.user_activity from authenticated;

create policy "activity: admins read" on public.user_activity
  for select to authenticated using (private.is_admin());
create policy "activity: read own" on public.user_activity
  for select to authenticated using (user_id = auth.uid());

-- Called by the website on signed-in page views. Writes at most every 5 minutes; a gap of more
-- than 30 minutes counts as a new visit.
create function public.touch_last_seen() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_prev timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;
  select last_seen_at into v_prev from public.profiles where id = auth.uid();
  if v_prev is not null and v_prev > now() - interval '5 minutes' then
    return;
  end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
  if v_prev is null or v_prev < now() - interval '30 minutes' then
    insert into public.user_activity (user_id, kind) values (auth.uid(), 'visit');
  end if;
end;
$$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Generic trigger: tg_argv = (kind, user column, reference column).
create function private.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(new);
  v_user uuid := (v_row ->> tg_argv[1])::uuid;
begin
  if v_user is not null then
    insert into public.user_activity (user_id, kind, ref) values (v_user, tg_argv[0], v_row ->> tg_argv[2]);
  end if;
  return new;
end;
$$;
revoke execute on function private.log_activity() from public, anon, authenticated;

create trigger flights_activity after insert on public.flights
  for each row execute function private.log_activity('flight.added', 'user_id', 'id');
create trigger ads_activity after insert on public.ads
  for each row execute function private.log_activity('ad.posted', 'owner_id', 'id');
create trigger event_rsvps_activity after insert on public.event_rsvps
  for each row execute function private.log_activity('event.rsvp', 'user_id', 'event_id');
create trigger trip_registrations_activity after insert on public.trip_registrations
  for each row execute function private.log_activity('trip.registered', 'user_id', 'trip_id');
create trigger news_comments_activity after insert on public.news_comments
  for each row execute function private.log_activity('comment.posted', 'author_id', 'news_id');
create trigger rides_activity after insert on public.rides
  for each row execute function private.log_activity('ride.posted', 'user_id', 'id');

insert into public.retention_policies (data_type, retain_days, description) values
  ('user_activity', 90, 'Activity log entries (visits, flights added, listings…) are kept this many days.')
on conflict (data_type) do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('trim-user-activity', '35 3 * * *', $job$
      delete from public.user_activity a
      using public.retention_policies r
      where r.data_type = 'user_activity' and r.retain_days is not null
        and a.created_at < now() - make_interval(days => r.retain_days)
    $job$);
  end if;
end $$;
