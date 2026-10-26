-- Phase 0 foundation: roles, profiles, audit log.
-- Conventions: RLS on every table, no permissive defaults, helper functions live in
-- the `private` schema (not exposed through the API) and use an empty search_path.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'pilot', 'member', 'instructor', 'moderator', 'safety_officer', 'admin'
);

create type public.visibility as enum ('public', 'members', 'private');

create type public.account_status as enum (
  'onboarding',          -- signed up, age not confirmed yet
  'pending_guardian',    -- 14–17, waiting for guardian consent
  'active',
  'deletion_requested'   -- anonymised, waiting for hard purge
);

create type public.age_group as enum ('minor', 'adult');

create type public.pilot_level as enum (
  'student', 'p1', 'p2', 'p3', 'p4', 'p5', 'tandem', 'instructor'
);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

create function private.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('admin');
$$;

-- Member-level roles see members-only content and fields.
create function private.is_member_level(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user
      and role in ('member', 'instructor', 'moderator', 'safety_officer', 'admin')
  );
$$;

grant execute on all functions in schema private to anon, authenticated, service_role;

create policy "roles: read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "roles: admins read all" on public.user_roles
  for select to authenticated using (private.is_admin());
create policy "roles: admins grant" on public.user_roles
  for insert to authenticated with check (private.is_admin() and granted_by = auth.uid());
create policy "roles: admins revoke" on public.user_roles
  for delete to authenticated using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log (admin / safety-officer access to sensitive data, role changes, deletions)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

create policy "audit: admins read" on public.audit_log
  for select to authenticated using (private.is_admin());

create function private.audit(
  p_action text, p_table text, p_target text, p_details jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_table, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function private.audit(text, text, text, jsonb) from public, anon, authenticated;

create function private.audit_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('role.grant', 'user_roles', new.user_id::text,
      jsonb_build_object('role', new.role));
    return new;
  else
    perform private.audit('role.revoke', 'user_roles', old.user_id::text,
      jsonb_build_object('role', old.role));
    return old;
  end if;
end;
$$;

create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function private.audit_role_change();

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create function private.valid_field_privacy(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p) k)
        = array['bio', 'full_name', 'home_site', 'location', 'photo', 'pilot_level', 'wings', 'years_flying']
    and not exists (
      select 1 from jsonb_each_text(p) e
      where e.value not in ('public', 'members', 'private')
    );
$$;

create function private.default_field_privacy(p_group public.age_group) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_group
    when 'minor' then jsonb_build_object(
      'full_name', 'private', 'photo', 'private', 'location', 'private', 'home_site', 'private',
      'pilot_level', 'private', 'years_flying', 'private', 'wings', 'private', 'bio', 'private')
    else jsonb_build_object(
      'full_name', 'members', 'photo', 'public', 'location', 'members', 'home_site', 'public',
      'pilot_level', 'public', 'years_flying', 'public', 'wings', 'public', 'bio', 'public')
  end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  full_name text check (char_length(full_name) <= 100),
  avatar_path text,
  country text check (char_length(country) = 2),
  city text check (char_length(city) <= 80),
  home_site text check (char_length(home_site) <= 120),
  pilot_level public.pilot_level,
  years_flying smallint check (years_flying between 0 and 80),
  wings text check (char_length(wings) <= 200),
  bio text check (char_length(bio) <= 500),
  field_privacy jsonb not null default private.default_field_privacy('minor')
    check (private.valid_field_privacy(field_privacy)),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  units jsonb not null default '{"system": "metric", "speed": "kmh"}'::jsonb,
  age_group public.age_group,
  status public.account_status not null default 'onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Users may only edit their own descriptive fields; status and age group are set by functions.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  display_name, full_name, avatar_path, country, city, home_site, pilot_level,
  years_flying, wings, bio, field_privacy, locale, units
) on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: admins read all" on public.profiles
  for select to authenticated using (private.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid() and status <> 'deletion_requested')
  with check (id = auth.uid());

-- Private profile data, owner only. The licence number is encrypted by the app server
-- (AES-256-GCM, key outside the database) before it is stored.
create table public.profile_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_date date,
  licence_number_enc text,
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
revoke insert, update, delete on public.profile_private from anon, authenticated;
revoke all on public.profile_private from anon;
grant update (licence_number_enc) on public.profile_private to authenticated;

create trigger profile_private_updated_at
  before update on public.profile_private
  for each row execute function private.set_updated_at();

create policy "profile_private: read own" on public.profile_private
  for select to authenticated using (user_id = auth.uid());
create policy "profile_private: update own" on public.profile_private
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
