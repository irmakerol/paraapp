-- Pilot profile (2026-10-27): flying since (year), weight, and running totals of hours and flights.
-- years_flying stays for old rows but is now derived from flying_since when that is set.

alter table public.profiles
  add column flying_since smallint check (flying_since between 1950 and 2100),
  add column weight_kg smallint check (weight_kg between 30 and 250),
  add column total_flight_hours numeric(7, 1) not null default 0
    check (total_flight_hours between 0 and 100000),
  add column total_flights integer not null default 0 check (total_flights between 0 and 1000000);

update public.profiles
set flying_since = extract(year from now())::smallint - years_flying
where years_flying is not null and flying_since is null;

grant update (flying_since, weight_kg, total_flight_hours, total_flights) on public.profiles to authenticated;

create function private.years_flying(p_since smallint, p_legacy smallint) returns smallint
language sql stable set search_path = '' as $$
  select coalesce(greatest(0, extract(year from now())::integer - p_since)::smallint, p_legacy);
$$;

-- Two more per-field privacy settings: weight (private by default) and flight totals.
create or replace function private.valid_field_privacy(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p) k)
        = array['bio', 'flight_totals', 'full_name', 'home_site', 'location', 'photo', 'pilot_level',
                'weight', 'wings', 'years_flying']
    and not exists (
      select 1 from jsonb_each_text(p) e
      where e.value not in ('public', 'members', 'private')
    );
$$;

create or replace function private.default_field_privacy(p_group public.age_group) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_group
    when 'minor' then jsonb_build_object(
      'full_name', 'private', 'photo', 'private', 'location', 'private', 'home_site', 'private',
      'pilot_level', 'private', 'years_flying', 'private', 'wings', 'private', 'bio', 'private',
      'weight', 'private', 'flight_totals', 'private')
    else jsonb_build_object(
      'full_name', 'members', 'photo', 'public', 'location', 'members', 'home_site', 'public',
      'pilot_level', 'public', 'years_flying', 'public', 'wings', 'public', 'bio', 'public',
      'weight', 'private', 'flight_totals', 'public')
  end;
$$;

update public.profiles
set field_privacy = field_privacy || jsonb_build_object(
  'weight', 'private',
  'flight_totals', case when age_group = 'adult' then 'public' else 'private' end)
where not (field_privacy ? 'weight');

-- Same masked view, with the new fields appended.
create or replace view public.profile_cards with (security_barrier = true) as
  select
    p.id,
    p.display_name,
    case when private.can_view_field(p.id, p.field_privacy ->> 'full_name') then p.full_name end as full_name,
    case when private.can_view_field(p.id, p.field_privacy ->> 'photo') then p.avatar_path end as avatar_path,
    case when private.can_view_field(p.id, p.field_privacy ->> 'location') then p.country end as country,
    case when private.can_view_field(p.id, p.field_privacy ->> 'location') then p.city end as city,
    case when private.can_view_field(p.id, p.field_privacy ->> 'home_site') then p.home_site end as home_site,
    case when private.can_view_field(p.id, p.field_privacy ->> 'pilot_level') then p.pilot_level end as pilot_level,
    case when private.can_view_field(p.id, p.field_privacy ->> 'years_flying')
      then private.years_flying(p.flying_since, p.years_flying) end as years_flying,
    case when private.can_view_field(p.id, p.field_privacy ->> 'wings') then p.wings end as wings,
    case when private.can_view_field(p.id, p.field_privacy ->> 'bio') then p.bio end as bio,
    private.is_member_level(p.id) as is_member,
    p.created_at,
    case when private.can_view_field(p.id, p.field_privacy ->> 'years_flying') then p.flying_since end as flying_since,
    case when private.can_view_field(p.id, p.field_privacy ->> 'weight') then p.weight_kg end as weight_kg,
    case when private.can_view_field(p.id, p.field_privacy ->> 'flight_totals') then p.total_flight_hours end as total_flight_hours,
    case when private.can_view_field(p.id, p.field_privacy ->> 'flight_totals') then p.total_flights end as total_flights
  from public.profiles p
  where p.status = 'active'
    and (
      auth.uid() is not null
      or (p.age_group = 'adult' and private.has_consent(p.id, 'public_profile'))
    );

-- Pilots add a flight to their totals when they choose to (after an import or, later, the tracker).
-- Each flight counts once.
alter table public.flights add column counted_in_totals boolean not null default false;

create function public.add_flights_to_totals(p_flights uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_seconds bigint;
begin
  if auth.uid() is null or coalesce(array_length(p_flights, 1), 0) > 500 then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  with counted as (
    update public.flights set counted_in_totals = true
    where id = any(p_flights) and user_id = auth.uid() and not counted_in_totals
    returning duration_s
  )
  select count(*), coalesce(sum(duration_s), 0) into v_count, v_seconds from counted;
  update public.profiles
  set total_flights = least(1000000, total_flights + v_count),
      total_flight_hours = least(100000, total_flight_hours + round(v_seconds / 3600.0, 1))
  where id = auth.uid();
  return v_count;
end;
$$;
revoke execute on function public.add_flights_to_totals(uuid[]) from public, anon;
grant execute on function public.add_flights_to_totals(uuid[]) to authenticated;

-- Account deletion clears the new fields too (request_account_deletion() predates them).
create function private.clear_deleted_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'deletion_requested' and old.status <> 'deletion_requested' then
    new.flying_since := null;
    new.weight_kg := null;
    new.total_flight_hours := 0;
    new.total_flights := 0;
  end if;
  return new;
end;
$$;
create trigger profiles_clear_deleted before update of status on public.profiles
  for each row execute function private.clear_deleted_profile();
