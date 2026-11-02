-- Roles renamed (Irmak, 2026-10-30): everyone signed in is a member, so "member" is shown as
-- "Misafir üye" (guest member, e.g. after a tandem flight) and is what a new account gets.
-- "Pilot" now means a licensed pilot and "Öğrenci pilot" a student; both count as members.

create or replace function private.is_member_level(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user
      and role in ('member', 'student_pilot', 'pilot', 'instructor', 'guide', 'moderator',
                   'safety_officer', 'trip_organiser', 'admin', 'super_admin')
  );
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
begin
  v_name := left(trim(coalesce(
    nullif(trim(v_meta ->> 'display_name'), ''),
    nullif(trim(v_meta ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 40);
  if char_length(coalesce(v_name, '')) < 2 then
    v_name := 'Pilot';
  end if;

  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    v_name,
    case when v_meta ->> 'locale' in ('tr', 'en') then v_meta ->> 'locale' else 'tr' end
  );
  -- Everyone who signs up is a (guest) member; admins add Öğrenci pilot / Pilot and the rest.
  insert into public.user_roles (user_id, role) values (new.id, 'member');

  if nullif(v_meta ->> 'birth_date', '') is not null then
    perform private.apply_age_gate(new.id, (v_meta ->> 'birth_date')::date);
  end if;
  return new;
end;
$$;
