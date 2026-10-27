-- Trips: detailed club trips with sites, guides, requirements, price, interest and registrations.
-- Separate from events (one-day meetings) and from news (announcements link to trips).

-- Trip organisers count as members (members-only content).
create or replace function private.is_member_level(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user
      and role in ('member', 'instructor', 'moderator', 'safety_officer', 'trip_organiser', 'admin')
  );
$$;

create function private.is_trip_organiser() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('instructor', 'trip_organiser', 'admin')
  );
$$;

-- Comparable rank of a pilot level (tandem ratings count as P5, instructors above everyone).
create function private.pilot_level_rank(p_level public.pilot_level) returns integer
language sql immutable set search_path = '' as $$
  select case p_level::text
    when 'student' then 0 when 'p1' then 1 when 'p2' then 2 when 'p3' then 3
    when 'p4' then 4 when 'p5' then 5 when 'tandem' then 5
    when 't1' then 5 when 't2' then 5 when 't3' then 5 when 'instructor' then 6
  end;
$$;

create type public.trip_status as enum ('draft', 'open', 'closed', 'completed', 'cancelled');
create type public.trip_registration_status as enum ('pending', 'accepted', 'waitlisted', 'declined', 'cancelled');
create type public.trip_payment_status as enum ('unpaid', 'deposit_paid', 'paid', 'refunded');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  summary text check (char_length(summary) <= 300),
  description_md text not null default '' check (char_length(description_md) <= 20000),
  itinerary_md text not null default '' check (char_length(itinerary_md) <= 20000),
  cover_path text check (char_length(cover_path) <= 300),
  destination_country text check (destination_country ~ '^[A-Z]{2}$'),
  destination_region text check (char_length(destination_region) <= 120),
  starts_on date not null,
  ends_on date not null,
  meeting_point text check (char_length(meeting_point) <= 200),
  meeting_at timestamptz,
  registration_opens_at timestamptz,
  registration_deadline timestamptz,
  max_pilots integer not null check (max_pilots between 1 and 500),
  min_pilots integer check (min_pilots between 1 and 500),
  companions_allowed boolean not null default false,
  min_pilot_level public.pilot_level,
  min_years_flying smallint check (min_years_flying between 0 and 80),
  min_flights integer check (min_flights between 0 and 100000),
  required_equipment text[] not null default '{}' check (cardinality(required_equipment) <= 20),
  requirements_md text not null default '' check (char_length(requirements_md) <= 5000),
  price_amount numeric(10, 2) check (price_amount >= 0),
  price_currency text not null default 'TRY' check (price_currency in ('TRY', 'EUR', 'USD')),
  deposit_amount numeric(10, 2) check (deposit_amount >= 0),
  payment_deadline date,
  payment_info_md text not null default '' check (char_length(payment_info_md) <= 3000),
  price_includes text check (char_length(price_includes) <= 2000),
  price_excludes text check (char_length(price_excludes) <= 2000),
  cancellation_policy text check (char_length(cancellation_policy) <= 3000),
  accommodation text check (char_length(accommodation) <= 2000),
  transport text check (char_length(transport) <= 2000),
  members_only boolean not null default false,
  allow_minors boolean not null default false,
  auto_accept boolean not null default false,
  status public.trip_status not null default 'draft',
  news_id uuid references public.news (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (min_pilots is null or min_pilots <= max_pilots),
  check (deposit_amount is null or price_amount is null or deposit_amount <= price_amount),
  check (registration_deadline is null or registration_opens_at is null
         or registration_deadline >= registration_opens_at)
);
create index trips_starts_idx on public.trips (starts_on);
alter table public.trips enable row level security;
create trigger trips_updated_at before update on public.trips
  for each row execute function private.set_updated_at();

create table public.trip_sites (
  trip_id uuid not null references public.trips (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  position smallint not null default 0,
  primary key (trip_id, site_id)
);
alter table public.trip_sites enable row level security;

create table public.trip_guides (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_label text check (char_length(role_label) <= 60),
  position smallint not null default 0,
  primary key (trip_id, user_id)
);
create index trip_guides_user_idx on public.trip_guides (user_id);
alter table public.trip_guides enable row level security;

-- Organisers (role) and the trip's own guides manage a trip's participants.
create function private.is_trip_staff(p_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_trip_organiser()
    or exists (select 1 from public.trip_guides where trip_id = p_trip and user_id = auth.uid());
$$;

create function private.trip_visible(p_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and ((t.status <> 'draft' and (not t.members_only or private.is_member_level()))
           or private.is_trip_staff(t.id))
  );
$$;

create policy "trips: visible" on public.trips
  for select to anon, authenticated using (
    status <> 'draft' and (not members_only or private.is_member_level())
  );
create policy "trips: staff read" on public.trips
  for select to authenticated using (private.is_trip_staff(id));
create policy "trips: organisers write" on public.trips
  for all to authenticated
  using (private.is_trip_organiser()) with check (private.is_trip_organiser());

create policy "trip sites: visible with trip" on public.trip_sites
  for select to anon, authenticated using (private.trip_visible(trip_id));
create policy "trip sites: organisers write" on public.trip_sites
  for all to authenticated
  using (private.is_trip_organiser()) with check (private.is_trip_organiser());

create policy "trip guides: visible with trip" on public.trip_guides
  for select to anon, authenticated using (private.trip_visible(trip_id));
create policy "trip guides: organisers write" on public.trip_guides
  for all to authenticated
  using (private.is_trip_organiser()) with check (private.is_trip_organiser());

-- Non-binding interest ------------------------------------------------------
create table public.trip_interests (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_interests_user_idx on public.trip_interests (user_id);
alter table public.trip_interests enable row level security;
revoke update on public.trip_interests from anon, authenticated;

create policy "trip interests: own" on public.trip_interests
  for select to authenticated using (user_id = auth.uid());
create policy "trip interests: staff read" on public.trip_interests
  for select to authenticated using (private.is_trip_staff(trip_id));
create policy "trip interests: add own" on public.trip_interests
  for insert to authenticated with check (
    user_id = auth.uid() and private.is_active_user() and private.trip_visible(trip_id)
    and exists (select 1 from public.trips t where t.id = trip_id and t.status in ('open', 'closed')
                and (t.allow_minors or private.is_adult()))
  );
create policy "trip interests: remove own" on public.trip_interests
  for delete to authenticated using (user_id = auth.uid());

-- Registrations ("subscribe") -----------------------------------------------
-- Pilots never write this table directly: they use register_for_trip() and
-- cancel_trip_registration(). Staff change status, payment and their own note.
create table public.trip_registrations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.trip_registration_status not null default 'pending',
  companions smallint not null default 0 check (companions between 0 and 5),
  note text check (char_length(note) <= 500),
  phone text check (char_length(phone) <= 30),
  emergency_name text check (char_length(emergency_name) <= 100),
  emergency_phone text check (char_length(emergency_phone) <= 30),
  -- Snapshot at registration, shared with the trip staff by registering.
  pilot_level public.pilot_level,
  years_flying smallint,
  logged_flights integer,
  payment_status public.trip_payment_status not null default 'unpaid',
  staff_note text check (char_length(staff_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index trip_registrations_user_idx on public.trip_registrations (user_id);
create index trip_registrations_queue_idx on public.trip_registrations (trip_id, status, created_at);
alter table public.trip_registrations enable row level security;
create trigger trip_registrations_updated_at before update on public.trip_registrations
  for each row execute function private.set_updated_at();

revoke insert, update, delete on public.trip_registrations from anon, authenticated;
grant update (status, payment_status, staff_note) on public.trip_registrations to authenticated;

create policy "trip registrations: own" on public.trip_registrations
  for select to authenticated using (user_id = auth.uid());
create policy "trip registrations: staff read" on public.trip_registrations
  for select to authenticated using (private.is_trip_staff(trip_id));
create policy "trip registrations: staff update" on public.trip_registrations
  for update to authenticated
  using (private.is_trip_staff(trip_id)) with check (private.is_trip_staff(trip_id));

-- Seats taken = accepted + pending (pending registrations hold a seat until decided).
create function private.trip_seats_taken(p_trip uuid, p_except uuid default null) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(1 + companions), 0)::integer from public.trip_registrations
  where trip_id = p_trip and status in ('accepted', 'pending')
    and (p_except is null or id <> p_except);
$$;

create function private.notify_trip(p_user uuid, p_kind text, p_trip public.trips, p_extra jsonb default '{}')
returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, payload)
  values (p_user, p_kind,
          jsonb_build_object('trip_id', p_trip.id, 'slug', p_trip.slug, 'title', p_trip.title) || p_extra);
$$;
revoke execute on function private.notify_trip(uuid, text, public.trips, jsonb) from public, anon, authenticated;

-- Staff can't accept beyond capacity; every status change is stamped and the pilot is told.
create function private.trip_registration_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select * into v_trip from public.trips where id = new.trip_id;
  if new.status in ('accepted', 'pending') and old.status not in ('accepted', 'pending')
     and private.trip_seats_taken(new.trip_id, new.id) + 1 + new.companions > v_trip.max_pilots then
    raise exception 'trip_full' using errcode = '22023';
  end if;
  new.decided_at := now();
  perform private.notify_trip(new.user_id, 'trip_registration', v_trip,
                              jsonb_build_object('status', new.status));
  return new;
end;
$$;
create trigger trip_registrations_status before update of status on public.trip_registrations
  for each row execute function private.trip_registration_changed();

-- When a seat frees up, the first person on the waiting list moves up.
create function private.promote_trip_waitlist(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
  v_next public.trip_registrations;
begin
  select * into v_trip from public.trips where id = p_trip;
  if v_trip.status <> 'open' then
    return;
  end if;
  loop
    select * into v_next from public.trip_registrations
    where trip_id = p_trip and status = 'waitlisted'
    order by created_at limit 1;
    exit when v_next.id is null
      or private.trip_seats_taken(p_trip) + 1 + v_next.companions > v_trip.max_pilots;
    update public.trip_registrations
    set status = case when v_trip.auto_accept and private.is_adult(v_next.user_id)
                      then 'accepted'::public.trip_registration_status
                      else 'pending'::public.trip_registration_status end
    where id = v_next.id;
    v_next := null;
  end loop;
end;
$$;
revoke execute on function private.promote_trip_waitlist(uuid) from public, anon, authenticated;

create function private.trip_registration_freed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status in ('accepted', 'pending') and new.status not in ('accepted', 'pending') then
    perform private.promote_trip_waitlist(new.trip_id);
  end if;
  return null;
end;
$$;
create trigger trip_registrations_freed after update of status on public.trip_registrations
  for each row execute function private.trip_registration_freed();

-- More seats or a re-opened trip moves the waiting list up; a cancelled trip tells everyone.
create function private.trip_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform private.notify_trip(r.user_id, 'trip_cancelled', new)
    from public.trip_registrations r
    where r.trip_id = new.id and r.status in ('accepted', 'pending', 'waitlisted');
  elsif new.status = 'open' and (old.status <> 'open' or new.max_pilots > old.max_pilots) then
    perform private.promote_trip_waitlist(new.id);
  end if;
  return null;
end;
$$;
create trigger trips_changed after update of status, max_pilots on public.trips
  for each row execute function private.trip_changed();

-- Pilots: register (or re-register after cancelling).
create function public.register_for_trip(
  p_trip uuid,
  p_companions smallint default 0,
  p_note text default null,
  p_phone text default null,
  p_emergency_name text default null,
  p_emergency_phone text default null
) returns public.trip_registration_status
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips;
  v_profile public.profiles;
  v_existing public.trip_registrations;
  v_status public.trip_registration_status;
  v_flights integer;
begin
  if v_uid is null or not private.is_active_user(v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_trip from public.trips where id = p_trip;
  if v_trip.id is null or not private.trip_visible(p_trip) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if v_trip.status <> 'open'
     or (v_trip.registration_opens_at is not null and v_trip.registration_opens_at > now())
     or (v_trip.registration_deadline is not null and v_trip.registration_deadline < now())
     or v_trip.starts_on < (now() at time zone 'Europe/Istanbul')::date then
    raise exception 'registration_closed' using errcode = '22023';
  end if;
  if not v_trip.allow_minors and not private.is_adult(v_uid) then
    raise exception 'adults_only' using errcode = '42501';
  end if;
  if coalesce(p_companions, 0) > 0 and not v_trip.companions_allowed then
    raise exception 'no_companions' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_trip.min_pilot_level is not null and (v_profile.pilot_level is null
     or private.pilot_level_rank(v_profile.pilot_level) < private.pilot_level_rank(v_trip.min_pilot_level)) then
    raise exception 'requirements_not_met' using errcode = '22023';
  end if;
  if v_trip.min_years_flying is not null
     and coalesce(private.years_flying(v_profile.flying_since, v_profile.years_flying), 0) < v_trip.min_years_flying then
    raise exception 'requirements_not_met' using errcode = '22023';
  end if;
  -- The pilot's own total if they keep one, otherwise the flights in the logbook.
  select greatest(v_profile.total_flights, count(*)) into v_flights from public.flights where user_id = v_uid;

  select * into v_existing from public.trip_registrations where trip_id = p_trip and user_id = v_uid;
  if v_existing.id is not null and v_existing.status not in ('cancelled', 'declined') then
    raise exception 'already_registered' using errcode = '22023';
  end if;
  if v_existing.status = 'declined' then
    raise exception 'declined' using errcode = '42501';
  end if;

  if private.trip_seats_taken(p_trip, v_existing.id) + 1 + coalesce(p_companions, 0) > v_trip.max_pilots
     or exists (select 1 from public.trip_registrations
                where trip_id = p_trip and status = 'waitlisted' and user_id <> v_uid) then
    v_status := 'waitlisted';
  elsif v_trip.auto_accept and private.is_adult(v_uid) then
    v_status := 'accepted';
  else
    v_status := 'pending';
  end if;

  if v_existing.id is null then
    insert into public.trip_registrations
      (trip_id, user_id, status, companions, note, phone, emergency_name, emergency_phone,
       pilot_level, years_flying, logged_flights)
    values
      (p_trip, v_uid, v_status, coalesce(p_companions, 0), nullif(trim(p_note), ''),
       nullif(trim(p_phone), ''), nullif(trim(p_emergency_name), ''), nullif(trim(p_emergency_phone), ''),
       v_profile.pilot_level, private.years_flying(v_profile.flying_since, v_profile.years_flying), v_flights);
  else
    -- Re-registering puts you at the back of the queue.
    update public.trip_registrations set
      status = v_status, companions = coalesce(p_companions, 0), note = nullif(trim(p_note), ''),
      phone = nullif(trim(p_phone), ''), emergency_name = nullif(trim(p_emergency_name), ''),
      emergency_phone = nullif(trim(p_emergency_phone), ''), pilot_level = v_profile.pilot_level,
      years_flying = private.years_flying(v_profile.flying_since, v_profile.years_flying), logged_flights = v_flights,
      payment_status = 'unpaid', staff_note = null, created_at = now()
    where id = v_existing.id;
  end if;
  -- Registering replaces "interested".
  delete from public.trip_interests where trip_id = p_trip and user_id = v_uid;
  -- Tell whoever created the trip.
  if v_trip.created_by is not null and v_trip.created_by <> v_uid then
    perform private.notify_trip(v_trip.created_by, 'trip_new_registration', v_trip,
                                jsonb_build_object('status', v_status));
  end if;
  return v_status;
end;
$$;
revoke execute on function public.register_for_trip(uuid, smallint, text, text, text, text) from public, anon;
grant execute on function public.register_for_trip(uuid, smallint, text, text, text, text) to authenticated;

create function public.cancel_trip_registration(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.trip_registrations;
  v_trip public.trips;
begin
  select * into v_reg from public.trip_registrations where trip_id = p_trip and user_id = auth.uid();
  if v_reg.id is null or v_reg.status in ('cancelled', 'declined') then
    raise exception 'not_registered' using errcode = '22023';
  end if;
  select * into v_trip from public.trips where id = p_trip;
  if v_trip.status in ('completed', 'cancelled') then
    raise exception 'registration_closed' using errcode = '22023';
  end if;
  update public.trip_registrations set status = 'cancelled' where id = v_reg.id;
  if v_trip.created_by is not null and v_trip.created_by <> auth.uid() then
    perform private.notify_trip(v_trip.created_by, 'trip_registration_cancelled', v_trip);
  end if;
end;
$$;
revoke execute on function public.cancel_trip_registration(uuid) from public, anon;
grant execute on function public.cancel_trip_registration(uuid) to authenticated;

-- Pilots may update their own contact details and note while the registration is active.
create function public.update_trip_registration(
  p_trip uuid, p_note text, p_phone text, p_emergency_name text, p_emergency_phone text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.trip_registrations set
    note = nullif(trim(p_note), ''), phone = nullif(trim(p_phone), ''),
    emergency_name = nullif(trim(p_emergency_name), ''),
    emergency_phone = nullif(trim(p_emergency_phone), '')
  where trip_id = p_trip and user_id = auth.uid() and status not in ('cancelled', 'declined');
  if not found then
    raise exception 'not_registered' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.update_trip_registration(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_trip_registration(uuid, text, text, text, text) to authenticated;

-- Staff: tell everyone interested (and optionally everyone registered) about an update.
create function public.notify_trip_followers(p_trip uuid, p_include_registered boolean default false)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
  v_count integer;
begin
  if not private.is_trip_staff(p_trip) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_trip from public.trips where id = p_trip;
  with recipients as (
    select user_id from public.trip_interests where trip_id = p_trip
    union
    select user_id from public.trip_registrations
    where p_include_registered and trip_id = p_trip and status in ('accepted', 'pending', 'waitlisted')
  ), inserted as (
    insert into public.notifications (user_id, kind, payload)
    select user_id, 'trip_update',
           jsonb_build_object('trip_id', v_trip.id, 'slug', v_trip.slug, 'title', v_trip.title)
    from recipients
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;
revoke execute on function public.notify_trip_followers(uuid, boolean) from public, anon;
grant execute on function public.notify_trip_followers(uuid, boolean) to authenticated;

-- Public numbers; names are only for staff.
create function public.trip_counts(p_trip uuid)
returns table (seats_taken integer, accepted bigint, pending bigint, waitlisted bigint, interested bigint)
language sql stable security definer set search_path = '' as $$
  select
    private.trip_seats_taken(p_trip),
    (select count(*) from public.trip_registrations where trip_id = p_trip and status = 'accepted'),
    (select count(*) from public.trip_registrations where trip_id = p_trip and status = 'pending'),
    (select count(*) from public.trip_registrations where trip_id = p_trip and status = 'waitlisted'),
    (select count(*) from public.trip_interests where trip_id = p_trip)
  where private.trip_visible(p_trip);
$$;
grant execute on function public.trip_counts(uuid) to anon, authenticated;

-- Trip organisers may upload trip covers into the public content bucket under trips/.
create policy "content: trip organisers upload trip covers" on storage.objects
  for all to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'trips' and private.is_trip_organiser())
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'trips' and private.is_trip_organiser());

-- Retention: contact details are removed after the trip, registrations after a year.
insert into public.retention_policies (data_type, retain_days, description) values
  ('trip_contact_details', 30, 'Phone and emergency contacts in trip registrations are removed this many days after the trip ends.'),
  ('trip_registrations', 730, 'Trip registrations and interest are deleted this many days after the trip ends.')
on conflict (data_type) do nothing;

create function private.purge_trip_personal_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.trip_registrations r
  set phone = null, emergency_name = null, emergency_phone = null
  from public.trips t, public.retention_policies p
  where r.trip_id = t.id and p.data_type = 'trip_contact_details'
    and t.ends_on < current_date - coalesce(p.retain_days, 30)
    and (r.phone is not null or r.emergency_name is not null or r.emergency_phone is not null);
  delete from public.trip_registrations r
  using public.trips t, public.retention_policies p
  where r.trip_id = t.id and p.data_type = 'trip_registrations'
    and t.ends_on < current_date - coalesce(p.retain_days, 730);
  delete from public.trip_interests i
  using public.trips t, public.retention_policies p
  where i.trip_id = t.id and p.data_type = 'trip_registrations'
    and t.ends_on < current_date - coalesce(p.retain_days, 730);
end;
$$;
revoke execute on function private.purge_trip_personal_data() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-trip-personal-data', '50 3 * * *', 'select private.purge_trip_personal_data()');
  end if;
end $$;
