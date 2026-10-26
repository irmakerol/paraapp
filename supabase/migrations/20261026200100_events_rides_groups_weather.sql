-- Phase 3: events with RSVPs, carpool/retrieve board, group chats, cached weather.

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

-- Admins and instructors organise events.
create function private.is_event_organiser() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('instructor', 'admin')
  );
$$;

create type public.event_kind as enum ('club_trip', 'course', 'competition', 'social', 'meeting', 'other');
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.rsvp_status as enum ('going', 'maybe', 'not_going');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  description_md text not null default '' check (char_length(description_md) <= 10000),
  kind public.event_kind not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  site_id uuid references public.sites (id) on delete set null,
  location_text text check (char_length(location_text) <= 200),
  members_only boolean not null default false,
  capacity integer check (capacity between 1 and 10000),
  rsvp_deadline timestamptz,
  status public.event_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;
create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create function private.event_visible(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and (e.status in ('published', 'cancelled') and (not e.members_only or private.is_member_level())
           or private.is_event_organiser())
  );
$$;

create policy "events: visible" on public.events
  for select to anon, authenticated using (
    status in ('published', 'cancelled') and (not members_only or private.is_member_level())
  );
create policy "events: organisers read all" on public.events
  for select to authenticated using (private.is_event_organiser());
create policy "events: organisers write" on public.events
  for all to authenticated
  using (private.is_event_organiser()) with check (private.is_event_organiser());

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.rsvp_status not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_idx on public.event_rsvps (user_id);
alter table public.event_rsvps enable row level security;
create trigger event_rsvps_updated_at before update on public.event_rsvps
  for each row execute function private.set_updated_at();

-- Sign-ups only for visible, published, upcoming events before the deadline and within capacity.
create function private.check_rsvp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_going integer;
begin
  select * into v_event from public.events where id = new.event_id;
  if v_event.status <> 'published' or v_event.ends_at < now()
     or (v_event.rsvp_deadline is not null and v_event.rsvp_deadline < now()) then
    raise exception 'rsvp_closed' using errcode = '22023';
  end if;
  if new.status = 'going' and v_event.capacity is not null
     and (tg_op = 'INSERT' or old.status <> 'going') then
    select count(*) into v_going from public.event_rsvps
    where event_id = new.event_id and status = 'going';
    if v_going >= v_event.capacity then
      raise exception 'event_full' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger event_rsvps_check before insert or update on public.event_rsvps
  for each row execute function private.check_rsvp();

revoke update on public.event_rsvps from anon, authenticated;
grant update (status, note) on public.event_rsvps to authenticated;

create policy "rsvps: own" on public.event_rsvps
  for select to authenticated using (user_id = auth.uid());
create policy "rsvps: organisers read" on public.event_rsvps
  for select to authenticated using (private.is_event_organiser());
create policy "rsvps: sign up as self" on public.event_rsvps
  for insert to authenticated
  with check (user_id = auth.uid() and private.is_active_user() and private.event_visible(event_id));
create policy "rsvps: change own" on public.event_rsvps
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rsvps: withdraw own" on public.event_rsvps
  for delete to authenticated using (user_id = auth.uid());

-- Public counts; attendee names are only for organisers.
create function public.event_counts(p_event uuid)
returns table (going bigint, maybe bigint)
language sql stable security definer set search_path = '' as $$
  select count(*) filter (where status = 'going'), count(*) filter (where status = 'maybe')
  from public.event_rsvps
  where event_id = p_event and private.event_visible(p_event);
$$;
grant execute on function public.event_counts(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Carpool and retrieve board (adults only: no ride arrangements with minors)
-- ---------------------------------------------------------------------------

create type public.ride_kind as enum ('offer', 'request');
create type public.ride_purpose as enum ('carpool', 'retrieve');

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.ride_kind not null,
  purpose public.ride_purpose not null default 'carpool',
  ride_date date not null,
  depart_time time,
  from_text text not null check (char_length(from_text) between 2 and 120),
  site_id uuid references public.sites (id) on delete set null,
  to_text text check (char_length(to_text) <= 120),
  seats smallint check (seats between 1 and 8),
  note text check (char_length(note) <= 1000),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index rides_date_idx on public.rides (ride_date);
alter table public.rides enable row level security;

create function private.can_use_rides() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and private.is_adult(auth.uid());
$$;

revoke update on public.rides from anon, authenticated;
grant update (kind, purpose, ride_date, depart_time, from_text, site_id, to_text, seats, note, closed)
  on public.rides to authenticated;

create policy "rides: adults read" on public.rides
  for select to authenticated using (private.can_use_rides() or private.is_moderator());
create policy "rides: adults post" on public.rides
  for insert to authenticated
  with check (user_id = auth.uid() and private.can_use_rides() and ride_date >= current_date);
create policy "rides: owner edits" on public.rides
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rides: owner or moderator deletes" on public.rides
  for delete to authenticated using (user_id = auth.uid() or private.is_moderator());

alter type public.report_target add value if not exists 'ride';
alter type public.report_target add value if not exists 'event';

-- ---------------------------------------------------------------------------
-- Group chats (adults only for now; minors keep 1-to-1 chats with the follow rule)
-- ---------------------------------------------------------------------------

create function private.can_join_group(p_adder uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user(p_user)
     and private.is_adult(p_user)
     and not private.is_blocked_between(p_adder, p_user);
$$;

create function public.create_group_chat(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_member uuid;
begin
  if v_me is null or not private.is_active_user(v_me) or not private.is_adult(v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_title), '')) not between 1 and 80 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  if coalesce(array_length(p_members, 1), 0) not between 1 and 49 then
    raise exception 'invalid_members' using errcode = '22023';
  end if;
  insert into public.chats (kind, title, created_by) values ('group', trim(p_title), v_me)
  returning id into v_chat;
  insert into public.chat_members (chat_id, user_id) values (v_chat, v_me);
  foreach v_member in array p_members loop
    if v_member = v_me then continue; end if;
    if not private.can_join_group(v_me, v_member) then
      raise exception 'member_not_allowed' using errcode = '42501';
    end if;
    insert into public.chat_members (chat_id, user_id) values (v_chat, v_member)
    on conflict do nothing;
  end loop;
  return v_chat;
end;
$$;
revoke execute on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

create function public.add_group_member(p_chat uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.chats where id = p_chat and kind = 'group')
     or not private.is_chat_member(p_chat)
     or not private.can_join_group(auth.uid(), p_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select count(*) into v_count from public.chat_members where chat_id = p_chat;
  if v_count >= 50 then
    raise exception 'group_full' using errcode = '22023';
  end if;
  insert into public.chat_members (chat_id, user_id) values (p_chat, p_user) on conflict do nothing;
end;
$$;
revoke execute on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Leave a group, or (as its creator) remove someone from it.
create function public.remove_group_member(p_chat uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.chats
    where id = p_chat and kind = 'group'
      and (p_user = auth.uid() or created_by = auth.uid())
  ) or not private.is_chat_member(p_chat) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.chat_members where chat_id = p_chat and user_id = p_user;
end;
$$;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

create function public.rename_group_chat(p_chat uuid, p_title text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(trim(p_title), '')) not between 1 and 80 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  update public.chats set title = trim(p_title)
  where id = p_chat and kind = 'group' and private.is_chat_member(p_chat);
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.rename_group_chat(uuid, text) from public, anon;
grant execute on function public.rename_group_chat(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Weather: forecasts fetched by the server from Open-Meteo, cached per site
-- ---------------------------------------------------------------------------

create table public.weather_forecasts (
  site_id uuid primary key references public.sites (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  data jsonb not null
);
alter table public.weather_forecasts enable row level security;
revoke insert, update, delete on public.weather_forecasts from anon, authenticated;
create policy "weather: everyone reads" on public.weather_forecasts
  for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-old-rides', '40 3 * * *', $job$
      delete from public.rides r
      using public.retention_policies p
      where p.data_type = 'rides'
        and r.ride_date < current_date - coalesce(p.retain_days, 30)
    $job$);
    perform cron.schedule('purge-old-rsvps', '45 3 * * *', $job$
      delete from public.event_rsvps v
      using public.events e, public.retention_policies p
      where p.data_type = 'event_rsvps' and v.event_id = e.id
        and e.ends_at < now() - make_interval(days => coalesce(p.retain_days, 365))
    $job$);
  end if;
end;
$$;
