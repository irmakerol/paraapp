-- Phase 2: sites (PostGIS), equipment with reminders, flights, follows.

-- ---------------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------------

create type public.site_kind as enum ('launch', 'landing', 'both');

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  kind public.site_kind not null default 'launch',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  elevation_m integer check (elevation_m between -500 and 9000),
  -- Wind directions the site works in, e.g. {N,NW}.
  wind_directions text[] not null default '{}'
    check (wind_directions <@ array['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
  region text check (char_length(region) <= 80),
  country text not null default 'TR' check (char_length(country) = 2),
  description text not null default '' check (char_length(description) <= 5000),
  rules text not null default '' check (char_length(rules) <= 3000),
  -- Unverified sites show a "check locally" warning.
  verified boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_location_idx on public.sites using gist (location);
alter table public.sites enable row level security;
create trigger sites_updated_at before update on public.sites
  for each row execute function private.set_updated_at();

create policy "sites: everyone reads" on public.sites
  for select to anon, authenticated using (true);
create policy "sites: moderators manage" on public.sites
  for all to authenticated using (private.is_moderator()) with check (private.is_moderator());

-- Nearest site within p_max_m metres (used to match imported flights).
create function public.nearest_site(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns uuid
language sql stable set search_path = '' as $$
  select s.id
  from public.sites s
  where extensions.st_dwithin(
    s.location,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    p_max_m
  )
  order by extensions.st_distance(
    s.location,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  )
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Equipment (private to its owner)
-- ---------------------------------------------------------------------------

create type public.equipment_kind as enum (
  'wing', 'harness', 'reserve', 'instrument', 'helmet', 'radio', 'other'
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.equipment_kind not null,
  brand text check (char_length(brand) <= 60),
  model text not null check (char_length(model) between 1 and 80),
  size text check (char_length(size) <= 20),
  certification text check (char_length(certification) <= 20),
  purchased_on date,
  -- Line check / trim (wings) or general inspection.
  last_check_on date,
  check_interval_months smallint check (check_interval_months between 1 and 120),
  -- Reserve repacking.
  last_repack_on date,
  repack_interval_months smallint check (repack_interval_months between 1 and 60),
  check_reminded_on date,
  repack_reminded_on date,
  retired boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_user_idx on public.equipment (user_id);
alter table public.equipment enable row level security;
create trigger equipment_updated_at before update on public.equipment
  for each row execute function private.set_updated_at();
revoke update on public.equipment from anon, authenticated;
grant update (
  kind, brand, model, size, certification, purchased_on, last_check_on, check_interval_months,
  last_repack_on, repack_interval_months, retired, notes
) on public.equipment to authenticated;

create policy "equipment: own" on public.equipment
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A new check/repack date resets the reminder.
create function private.reset_equipment_reminders() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.last_check_on is distinct from old.last_check_on
     or new.check_interval_months is distinct from old.check_interval_months then
    new.check_reminded_on := null;
  end if;
  if new.last_repack_on is distinct from old.last_repack_on
     or new.repack_interval_months is distinct from old.repack_interval_months then
    new.repack_reminded_on := null;
  end if;
  return new;
end;
$$;
create trigger equipment_reset_reminders before update on public.equipment
  for each row execute function private.reset_equipment_reminders();

-- Daily: in-app (and push) reminder 14 days before a check or repack is due.
create function private.process_equipment_reminders() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, payload)
  select user_id, 'equipment_check_due',
         jsonb_build_object('equipment_id', id, 'model', model,
           'due_on', (last_check_on + make_interval(months => check_interval_months))::date)
  from public.equipment
  where not retired and last_check_on is not null and check_interval_months is not null
    and check_reminded_on is null
    and last_check_on + make_interval(months => check_interval_months) < current_date + 14;
  update public.equipment set check_reminded_on = current_date
  where not retired and last_check_on is not null and check_interval_months is not null
    and check_reminded_on is null
    and last_check_on + make_interval(months => check_interval_months) < current_date + 14;

  insert into public.notifications (user_id, kind, payload)
  select user_id, 'equipment_repack_due',
         jsonb_build_object('equipment_id', id, 'model', model,
           'due_on', (last_repack_on + make_interval(months => repack_interval_months))::date)
  from public.equipment
  where not retired and last_repack_on is not null and repack_interval_months is not null
    and repack_reminded_on is null
    and last_repack_on + make_interval(months => repack_interval_months) < current_date + 14;
  update public.equipment set repack_reminded_on = current_date
  where not retired and last_repack_on is not null and repack_interval_months is not null
    and repack_reminded_on is null
    and last_repack_on + make_interval(months => repack_interval_months) < current_date + 14;
end;
$$;
revoke execute on function private.process_equipment_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Flights
-- ---------------------------------------------------------------------------

create type public.flight_source as enum ('igc', 'gpx', 'manual');

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  duration_s integer not null check (duration_s between 0 and 86400),
  takeoff_site_id uuid references public.sites (id) on delete set null,
  landing_site_id uuid references public.sites (id) on delete set null,
  -- Free text when no known site matches (manual entries).
  site_name text check (char_length(site_name) <= 120),
  glider text check (char_length(glider) <= 120),
  wing_id uuid references public.equipment (id) on delete set null,
  distance_m integer check (distance_m >= 0),
  straight_m integer check (straight_m >= 0),
  max_from_takeoff_m integer check (max_from_takeoff_m >= 0),
  takeoff_alt_m integer,
  landing_alt_m integer,
  max_alt_m integer,
  min_alt_m integer,
  max_climb_ms numeric(4, 1),
  max_sink_ms numeric(4, 1),
  visibility public.visibility not null default 'public',
  notes text check (char_length(notes) <= 2000),
  source public.flight_source not null,
  file_path text,
  file_sha256 text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  -- Compact track with the first and last 500 m removed: what other people may see.
  public_track jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_sha256)
);
create index flights_user_idx on public.flights (user_id, started_at desc);
create index flights_public_idx on public.flights (started_at desc) where visibility = 'public';
create index flights_takeoff_site_idx on public.flights (takeoff_site_id);
alter table public.flights enable row level security;
create trigger flights_updated_at before update on public.flights
  for each row execute function private.set_updated_at();

-- Imported flights are written by the server after it has analysed the file itself, so
-- records and stats can be trusted. Users can add manual flights and edit descriptive fields.
revoke insert, update on public.flights from anon, authenticated;
grant insert (
  user_id, started_at, duration_s, takeoff_site_id, landing_site_id, site_name, glider, wing_id,
  visibility, notes, source
) on public.flights to authenticated;
grant update (
  takeoff_site_id, landing_site_id, site_name, glider, wing_id, visibility, notes
) on public.flights to authenticated;

create policy "flights: owner reads" on public.flights
  for select to authenticated using (user_id = auth.uid());
create policy "flights: public" on public.flights
  for select to anon, authenticated
  using (visibility = 'public' and private.is_active_user(user_id));
create policy "flights: members" on public.flights
  for select to authenticated
  using (visibility = 'members' and private.is_member_level() and private.is_active_user(user_id));
create policy "flights: owner adds manual" on public.flights
  for insert to authenticated
  with check (user_id = auth.uid() and source = 'manual' and private.is_active_user());
create policy "flights: owner edits" on public.flights
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "flights: owner deletes" on public.flights
  for delete to authenticated using (user_id = auth.uid());

-- Minors' flights are never public.
create function private.flight_privacy_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'public' and not private.is_adult(new.user_id) then
    new.visibility := 'private';
  end if;
  if new.wing_id is not null
     and not exists (select 1 from public.equipment e where e.id = new.wing_id and e.user_id = new.user_id) then
    raise exception 'wing_not_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger flights_privacy_guard before insert or update on public.flights
  for each row execute function private.flight_privacy_guard();

-- Full track and exact takeoff/landing points: owner only.
create table public.flight_tracks (
  flight_id uuid primary key references public.flights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  track jsonb not null,
  takeoff_lat double precision,
  takeoff_lng double precision,
  landing_lat double precision,
  landing_lng double precision
);
alter table public.flight_tracks enable row level security;
revoke insert, update on public.flight_tracks from anon, authenticated;
create policy "flight tracks: owner reads" on public.flight_tracks
  for select to authenticated using (user_id = auth.uid());

-- Stats over the flights the viewer is allowed to see (security invoker: RLS applies).
create function public.pilot_stats(p_user uuid)
returns table (
  flights integer,
  total_s bigint,
  longest_s integer,
  max_distance_m integer,
  max_straight_m integer,
  max_alt_m integer,
  max_climb_ms numeric,
  first_flight timestamptz,
  last_flight timestamptz,
  sites integer
)
language sql stable security invoker set search_path = '' as $$
  select count(*)::integer,
         coalesce(sum(duration_s), 0)::bigint,
         max(duration_s),
         max(distance_m),
         max(straight_m),
         max(max_alt_m),
         max(max_climb_ms),
         min(started_at),
         max(started_at),
         count(distinct coalesce(takeoff_site_id::text, site_name))::integer
  from public.flights
  where user_id = p_user;
$$;

-- Original IGC/GPX files: private, owner only. Written by the server on import.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flight-files', 'flight-files', false, 10485760, null)
on conflict (id) do nothing;

create policy "flight-files: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'flight-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "flight-files: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'flight-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
revoke update on public.follows from anon, authenticated;

create policy "follows: involved read" on public.follows
  for select to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());
create policy "follows: follow as self" on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid() and private.is_active_user() and private.is_active_user(followee_id)
    and not private.is_blocked_between(follower_id, followee_id)
  );
-- Either side can end it (unfollow, or remove a follower).
create policy "follows: either side removes" on public.follows
  for delete to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());

-- Public counts without exposing who follows whom.
create function public.follow_counts(p_user uuid)
returns table (followers integer, following integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::integer from public.follows where followee_id = p_user),
         (select count(*)::integer from public.follows where follower_id = p_user);
$$;

-- Adults may start a chat with a minor only if the minor follows them.
create or replace function public.start_direct_chat(p_other uuid, p_ad uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
begin
  if v_me is null or not private.is_active_user(v_me) then
    raise exception 'not_active' using errcode = '42501';
  end if;
  if p_other = v_me or not private.is_active_user(p_other) then
    raise exception 'invalid_recipient' using errcode = '22023';
  end if;
  if private.is_blocked_between(v_me, p_other) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if private.is_adult(v_me) and not private.is_adult(p_other)
     and not exists (select 1 from public.follows where follower_id = p_other and followee_id = v_me) then
    raise exception 'minor_protected' using errcode = '42501';
  end if;

  select c.id into v_chat
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = v_me
  join public.chat_members b on b.chat_id = c.id and b.user_id = p_other
  where c.kind = 'direct' and c.ad_id is not distinct from p_ad
  limit 1;

  if v_chat is null then
    insert into public.chats (kind, ad_id, created_by) values ('direct', p_ad, v_me)
    returning id into v_chat;
    insert into public.chat_members (chat_id, user_id) values (v_chat, v_me), (v_chat, p_other);
  end if;
  return v_chat;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('equipment-reminders', '15 4 * * *', 'select private.process_equipment_reminders()');
  end if;
end $$;
