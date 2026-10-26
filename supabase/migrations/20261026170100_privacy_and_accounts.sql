-- Phase 0 privacy & account lifecycle: consents, legal documents, data-subject requests,
-- retention settings, sign-up trigger, age gate (14+), guardian consent, account deletion,
-- and the masked public profile view.

-- ---------------------------------------------------------------------------
-- Legal documents (privacy notice / aydınlatma metni, terms, explicit-consent texts)
-- ---------------------------------------------------------------------------

create type public.legal_document_kind as enum ('privacy_notice', 'terms', 'explicit_consent');

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_document_kind not null,
  locale text not null check (locale in ('tr', 'en')),
  version integer not null check (version > 0),
  title text not null,
  body_md text not null,
  -- A material change makes users accept / acknowledge the document again.
  material boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, locale, version)
);
alter table public.legal_documents enable row level security;

create policy "legal: anyone reads published" on public.legal_documents
  for select to anon, authenticated using (published_at is not null and published_at <= now());
create policy "legal: admins manage" on public.legal_documents
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.legal_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
alter table public.legal_acceptances enable row level security;
revoke update, delete on public.legal_acceptances from anon, authenticated;

create policy "acceptances: read own" on public.legal_acceptances
  for select to authenticated using (user_id = auth.uid());
create policy "acceptances: insert own" on public.legal_acceptances
  for insert to authenticated with check (user_id = auth.uid());

-- Kinds the current user still has to acknowledge (privacy notice) or accept (terms).
create function public.pending_legal_kinds() returns setof public.legal_document_kind
language sql stable security invoker set search_path = '' as $$
  with latest as (
    select kind, max(version) as version
    from public.legal_documents
    where material and published_at is not null and published_at <= now()
      and kind in ('privacy_notice', 'terms')
    group by kind
  ),
  accepted as (
    select d.kind, max(d.version) as version
    from public.legal_acceptances a
    join public.legal_documents d on d.id = a.document_id
    where a.user_id = auth.uid()
    group by d.kind
  )
  select l.kind
  from latest l
  left join accepted a on a.kind = l.kind
  where a.version is null or a.version < l.version;
$$;

-- ---------------------------------------------------------------------------
-- Consents (append-only; the latest row per type is the current state)
-- ---------------------------------------------------------------------------

create type public.consent_type as enum (
  'marketing_notifications', 'analytics', 'public_profile', 'live_location',
  'incident_special_category'
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  granted boolean not null,
  document_id uuid references public.legal_documents (id),
  method text not null check (method in ('signup', 'settings', 'feature_prompt')),
  created_at timestamptz not null default now()
);
create index consents_user_type_idx on public.consents (user_id, consent_type, created_at desc);
alter table public.consents enable row level security;
revoke update, delete, truncate on public.consents from anon, authenticated;

create policy "consents: read own" on public.consents
  for select to authenticated using (user_id = auth.uid());
create policy "consents: admins read" on public.consents
  for select to authenticated using (private.is_admin());
create policy "consents: record own" on public.consents
  for insert to authenticated with check (user_id = auth.uid());

create view public.current_consents with (security_invoker = true) as
  select distinct on (user_id, consent_type)
    user_id, consent_type, granted, document_id, method, created_at
  from public.consents
  order by user_id, consent_type, created_at desc, id desc;

create function private.has_consent(p_user uuid, p_type public.consent_type) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select granted from public.consents
    where user_id = p_user and consent_type = p_type
    order by created_at desc, id desc
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Data-subject requests (KVKK: 30 days, GDPR: one month — whichever is earlier)
-- ---------------------------------------------------------------------------

create type public.data_request_type as enum (
  'access', 'rectification', 'erasure', 'restriction', 'portability', 'objection',
  'withdraw_consent', 'other'
);
create type public.data_request_status as enum ('received', 'in_progress', 'completed', 'rejected');

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  requester_email text not null,
  request_type public.data_request_type not null,
  channel text not null check (channel in ('in_app', 'email', 'post', 'other')),
  details text check (char_length(details) <= 4000),
  status public.data_request_status not null default 'received',
  received_at timestamptz not null default now(),
  due_at timestamptz not null default now(),
  completed_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.data_requests enable row level security;

create function private.data_request_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.due_at := least(new.received_at + interval '30 days', new.received_at + interval '1 month');
  return new;
end;
$$;

create trigger data_requests_due
  before insert or update of received_at on public.data_requests
  for each row execute function private.data_request_defaults();
create trigger data_requests_updated_at
  before update on public.data_requests
  for each row execute function private.set_updated_at();

revoke insert, update, delete on public.data_requests from anon, authenticated;
grant insert (user_id, requester_email, request_type, channel, details) on public.data_requests to authenticated;
grant update (status, completed_at, handled_by, notes) on public.data_requests to authenticated;

create policy "dsr: read own" on public.data_requests
  for select to authenticated using (user_id = auth.uid());
create policy "dsr: file own in app" on public.data_requests
  for insert to authenticated
  with check (user_id = auth.uid() and channel = 'in_app' and status = 'received');
create policy "dsr: admins read" on public.data_requests
  for select to authenticated using (private.is_admin());
create policy "dsr: admins log" on public.data_requests
  for insert to authenticated with check (private.is_admin());
create policy "dsr: admins update" on public.data_requests
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Retention settings (read by scheduled jobs; NULL = keep until the user deletes it)
-- ---------------------------------------------------------------------------

create table public.retention_policies (
  data_type text primary key,
  retain_days integer check (retain_days is null or retain_days > 0),
  description text not null,
  updated_at timestamptz not null default now()
);
alter table public.retention_policies enable row level security;

create policy "retention: admins read" on public.retention_policies
  for select to authenticated using (private.is_admin());
create policy "retention: admins update" on public.retention_policies
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.retention_policies (data_type, retain_days, description) values
  ('deleted_accounts', 30, 'Days between an account deletion request and the hard purge.'),
  ('chat_messages', null, 'Kept until the user deletes them or their account.'),
  ('expired_ads', 180, 'Archived/expired marketplace ads are deleted after this many days.'),
  ('incident_personal_details', 365, 'Personal details in incident reports are anonymised this many days after the case is closed.'),
  ('live_tracking_points', 7, 'Live-tracking positions are deleted this many days after the link expires.'),
  ('guardian_requests', 30, 'Unconfirmed guardian consent requests are deleted this many days after expiry.'),
  ('audit_log', 730, 'Audit log entries are kept this many days.');

-- ---------------------------------------------------------------------------
-- Age gate (14+) and guardian consent for 14–17
-- ---------------------------------------------------------------------------

create function private.apply_age_gate(p_user uuid, p_birth_date date) returns public.account_status
language plpgsql security definer set search_path = '' as $$
declare
  v_age integer;
  v_group public.age_group;
  v_status public.account_status;
begin
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
  v_age := date_part('year', age(current_date, p_birth_date))::integer;
  if v_age < 14 then
    raise exception 'too_young' using errcode = '22023';
  end if;
  v_group := case when v_age < 18 then 'minor' else 'adult' end;
  v_status := case when v_group = 'minor' then 'pending_guardian' else 'active' end;

  insert into public.profile_private (user_id, birth_date)
  values (p_user, p_birth_date)
  on conflict (user_id) do update set birth_date = excluded.birth_date
    where public.profile_private.birth_date is null;

  update public.profiles
  set age_group = v_group,
      field_privacy = private.default_field_privacy(v_group),
      status = v_status
  where id = p_user and status = 'onboarding';

  if not found then
    raise exception 'age_gate_already_completed' using errcode = '22023';
  end if;
  return v_status;
end;
$$;
revoke execute on function private.apply_age_gate(uuid, date) from public, anon, authenticated;

-- Called by the signed-in user from onboarding (e.g. after Google sign-in).
create function public.complete_age_gate(p_birth_date date) returns public.account_status
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.apply_age_gate(auth.uid(), p_birth_date);
end;
$$;
revoke execute on function public.complete_age_gate(date) from public, anon;
grant execute on function public.complete_age_gate(date) to authenticated;

create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  guardian_name text not null check (char_length(guardian_name) between 2 and 100),
  guardian_email text not null check (char_length(guardian_email) <= 320),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);
alter table public.guardian_consents enable row level security;
revoke all on public.guardian_consents from anon, authenticated;
grant select (id, user_id, guardian_name, guardian_email, created_at, expires_at, confirmed_at)
  on public.guardian_consents to authenticated;

create policy "guardian: read own" on public.guardian_consents
  for select to authenticated using (user_id = auth.uid());

-- Server-only (service role): creates a request and returns the one-time token to e-mail.
-- The minor never sees the token, so they cannot confirm on the guardian's behalf.
create function public.create_guardian_request(p_user uuid, p_name text, p_email text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
begin
  if not exists (select 1 from public.profiles where id = p_user and status = 'pending_guardian') then
    raise exception 'not_pending_guardian' using errcode = '22023';
  end if;
  if (select count(*) from public.guardian_consents
      where user_id = p_user and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.guardian_consents (user_id, guardian_name, guardian_email, token_hash, expires_at)
  values (p_user, trim(p_name), lower(trim(p_email)),
          extensions.digest(v_token, 'sha256'), now() + interval '7 days');
  return v_token;
end;
$$;
revoke execute on function public.create_guardian_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_guardian_request(uuid, text, text) to service_role;

-- What the guardian sees before confirming.
create function public.guardian_request_info(p_token text)
returns table (display_name text, guardian_name text, expires_at timestamptz, confirmed boolean)
language sql stable security definer set search_path = '' as $$
  select p.display_name, g.guardian_name, g.expires_at, g.confirmed_at is not null
  from public.guardian_consents g
  join public.profiles p on p.id = g.user_id
  where g.token_hash = extensions.digest(p_token, 'sha256')
    and g.expires_at > now();
$$;
revoke execute on function public.guardian_request_info(text) from public;
grant execute on function public.guardian_request_info(text) to anon, authenticated;

create function public.confirm_guardian_consent(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.guardian_consents;
begin
  update public.guardian_consents
  set confirmed_at = now()
  where token_hash = extensions.digest(p_token, 'sha256')
    and expires_at > now()
    and confirmed_at is null
  returning * into v_row;

  if v_row.id is null then
    return false;
  end if;

  update public.profiles set status = 'active'
  where id = v_row.user_id and status = 'pending_guardian';

  perform private.audit('guardian.confirm', 'guardian_consents', v_row.id::text,
    jsonb_build_object('user_id', v_row.user_id));
  return true;
end;
$$;
revoke execute on function public.confirm_guardian_consent(text) from public;
grant execute on function public.confirm_guardian_consent(text) to anon, authenticated;

-- Daily: minors who turned 18 become adults (privacy settings are left as they chose).
create function private.promote_adults() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.profiles p
  set age_group = 'adult',
      status = case when p.status = 'pending_guardian' then 'active' else p.status end
  from public.profile_private pp
  where pp.user_id = p.id
    and p.age_group = 'minor'
    and pp.birth_date <= current_date - interval '18 years';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function private.promote_adults() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- New user: profile + pilot role (+ age gate when the sign-up form sent a birth date)
-- ---------------------------------------------------------------------------

create function private.handle_new_user() returns trigger
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
  insert into public.user_roles (user_id, role) values (new.id, 'pilot');

  if nullif(v_meta ->> 'birth_date', '') is not null then
    perform private.apply_age_gate(new.id, (v_meta ->> 'birth_date')::date);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Account deletion: anonymise now, purge after the retention period
-- ---------------------------------------------------------------------------

create table public.account_deletions (
  id bigint generated always as identity primary key,
  -- Deliberately not a foreign key: the row outlives the user as proof of deletion.
  user_id uuid not null,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null,
  purged_at timestamptz
);
alter table public.account_deletions enable row level security;
revoke insert, update, delete on public.account_deletions from anon, authenticated;

create policy "deletions: admins read" on public.account_deletions
  for select to authenticated using (private.is_admin());

create function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_days integer;
  v_purge timestamptz;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.account_deletions where user_id = v_user and purged_at is null) then
    raise exception 'deletion_already_requested' using errcode = '22023';
  end if;

  select coalesce(retain_days, 30) into v_days
  from public.retention_policies where data_type = 'deleted_accounts';
  v_purge := now() + make_interval(days => coalesce(v_days, 30));

  insert into public.account_deletions (user_id, purge_after) values (v_user, v_purge);

  update public.profiles set
    display_name = 'Deleted user', full_name = null, avatar_path = null, country = null,
    city = null, home_site = null, pilot_level = null, years_flying = null, wings = null,
    bio = null, field_privacy = private.default_field_privacy('minor'),
    status = 'deletion_requested'
  where id = v_user;

  delete from public.profile_private where user_id = v_user;
  delete from public.guardian_consents where user_id = v_user;
  delete from public.user_roles where user_id = v_user;

  -- Block sign-in and end every session immediately.
  update auth.users set banned_until = 'infinity' where id = v_user;
  delete from auth.sessions where user_id = v_user;

  perform private.audit('account.deletion_requested', 'profiles', v_user::text,
    jsonb_build_object('purge_after', v_purge));
  return v_purge;
end;
$$;
revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- Scheduled: hard-delete accounts whose grace period is over (cascades to all user data).
create function private.purge_deleted_accounts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with due as (
    update public.account_deletions
    set purged_at = now()
    where purged_at is null and purge_after <= now()
    returning user_id
  )
  delete from auth.users u using due where u.id = due.user_id;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform private.audit('account.purged', 'auth.users', null, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end;
$$;
revoke execute on function private.purge_deleted_accounts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public profile cards: per-field privacy applied for the current viewer
-- ---------------------------------------------------------------------------

create function private.can_view_field(p_owner uuid, p_visibility text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid()
      or p_visibility = 'public'
      or (p_visibility = 'members' and private.is_member_level());
$$;

-- Runs with the view owner's rights on purpose: it exposes only the masked columns below,
-- and only for active accounts. Guests see adults who consented to a public profile.
create view public.profile_cards with (security_barrier = true) as
  select
    p.id,
    p.display_name,
    case when private.can_view_field(p.id, p.field_privacy ->> 'full_name') then p.full_name end as full_name,
    case when private.can_view_field(p.id, p.field_privacy ->> 'photo') then p.avatar_path end as avatar_path,
    case when private.can_view_field(p.id, p.field_privacy ->> 'location') then p.country end as country,
    case when private.can_view_field(p.id, p.field_privacy ->> 'location') then p.city end as city,
    case when private.can_view_field(p.id, p.field_privacy ->> 'home_site') then p.home_site end as home_site,
    case when private.can_view_field(p.id, p.field_privacy ->> 'pilot_level') then p.pilot_level end as pilot_level,
    case when private.can_view_field(p.id, p.field_privacy ->> 'years_flying') then p.years_flying end as years_flying,
    case when private.can_view_field(p.id, p.field_privacy ->> 'wings') then p.wings end as wings,
    case when private.can_view_field(p.id, p.field_privacy ->> 'bio') then p.bio end as bio,
    private.is_member_level(p.id) as is_member,
    p.created_at
  from public.profiles p
  where p.status = 'active'
    and (
      auth.uid() is not null
      or (p.age_group = 'adult' and private.has_consent(p.id, 'public_profile'))
    );

revoke all on public.profile_cards from anon, authenticated;
grant select on public.profile_cards to anon, authenticated;
