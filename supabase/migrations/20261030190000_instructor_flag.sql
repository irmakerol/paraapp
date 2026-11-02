-- "Instructor" is no longer a pilot level: a pilot can be P5 and an instructor. The person ticks
-- a box on their profile (a claim shown on their profile). The `instructor` role, which grants
-- editing rights (Ground School, trips), stays admin-granted and is not changed by the box.

alter table public.profiles add column is_instructor boolean not null default false;
grant update (is_instructor) on public.profiles to authenticated;

update public.profiles p set is_instructor = true
where p.pilot_level = 'instructor'
   or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'instructor');

-- Same view, with the instructor claim appended (shown under the pilot level's privacy setting).
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
    case when private.can_view_field(p.id, p.field_privacy ->> 'flight_totals') then p.total_flights end as total_flights,
    -- Every hat a person wears (pilot, instructor, safety officer, …), most notable first.
    coalesce((
      select array_agg(r.role::text order by array_position(array[
        'super_admin', 'admin', 'instructor', 'safety_officer', 'moderator', 'trip_organiser',
        'guide', 'pilot', 'student_pilot', 'member']::text[], r.role::text))
      from public.user_roles r where r.user_id = p.id), '{}') as roles,
    case when private.can_view_field(p.id, p.field_privacy ->> 'pilot_level') then p.is_instructor
      else false end as is_instructor
  from public.profiles p
  where p.status = 'active'
    and (
      auth.uid() is not null
      or (p.age_group = 'adult' and private.has_consent(p.id, 'public_profile'))
    );
