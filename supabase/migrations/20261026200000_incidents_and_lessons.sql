-- Phase 3: incident reports (with encrypted injury details) and safety lessons.

-- Safety officers handle incident reports. Admins do not see injury details.
create function private.is_safety_officer() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('safety_officer');
$$;

create type public.incident_anonymity as enum (
  'named',                -- safety officers see who reported; lessons never name anyone
  'community_anonymous',  -- safety officers see who reported (for follow-up); nobody else ever
  'fully_anonymous'       -- nobody, not even safety officers: the reporter is not stored
);
create type public.incident_category as enum (
  'collapse', 'spiral_or_spin', 'reserve_deployment', 'takeoff', 'landing', 'tree_landing',
  'water_landing', 'collision', 'power_line', 'equipment_failure', 'weather', 'medical', 'other'
);
create type public.incident_severity as enum ('near_miss', 'minor', 'serious', 'fatal');
create type public.incident_status as enum ('submitted', 'in_review', 'closed');

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  -- Null for fully anonymous reports, and after the personal-data retention period.
  reporter_id uuid references auth.users (id) on delete set null,
  anonymity public.incident_anonymity not null,
  occurred_on date not null check (occurred_on <= current_date + 1),
  site_id uuid references public.sites (id) on delete set null,
  site_name text check (char_length(site_name) <= 120),
  category public.incident_category not null,
  severity public.incident_severity not null,
  injured boolean not null default false,
  description text not null check (char_length(description) between 20 and 8000),
  conditions text check (char_length(conditions) <= 2000),
  equipment text check (char_length(equipment) <= 500),
  lessons text check (char_length(lessons) <= 4000),
  -- The reporter agrees that a safety officer may contact them (never for fully anonymous).
  contact_ok boolean not null default false,
  -- Explicit consent (KVKK Art. 6 / GDPR Art. 9) given in the form for injury details.
  special_category_consent boolean not null default false,
  status public.incident_status not null default 'submitted',
  assigned_to uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  personal_data_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((anonymity = 'fully_anonymous') <= (reporter_id is null)),
  check (not (anonymity = 'fully_anonymous' and contact_ok))
);
create index incident_reports_status_idx on public.incident_reports (status, created_at desc);
create index incident_reports_reporter_idx on public.incident_reports (reporter_id);
alter table public.incident_reports enable row level security;
create trigger incident_reports_updated_at before update on public.incident_reports
  for each row execute function private.set_updated_at();

revoke insert, update, delete on public.incident_reports from anon, authenticated;
grant insert (
  reporter_id, anonymity, occurred_on, site_id, site_name, category, severity, injured,
  description, conditions, equipment, lessons, contact_ok, special_category_consent
) on public.incident_reports to authenticated;
grant update (status, assigned_to, closed_at) on public.incident_reports to authenticated;

-- Named and community-anonymous reports are filed under the reporter's own id. Fully anonymous
-- reports are written by the server with the service role, so no user id reaches the database.
create policy "incidents: report as self" on public.incident_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and anonymity in ('named', 'community_anonymous')
    and status = 'submitted'
    and private.is_active_user()
  );
create policy "incidents: reporter reads own" on public.incident_reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "incidents: safety officers read" on public.incident_reports
  for select to authenticated using (private.is_safety_officer());
create policy "incidents: safety officers update" on public.incident_reports
  for update to authenticated
  using (private.is_safety_officer()) with check (private.is_safety_officer());

-- Injury details (health data) are encrypted by the app and kept in their own table with no
-- policies at all: they can only be read through read_incident_injury(), which audits.
create table public.incident_injuries (
  incident_id uuid primary key references public.incident_reports (id) on delete cascade,
  details_enc text not null check (details_enc like 'v1.%')
);
alter table public.incident_injuries enable row level security;
revoke all on public.incident_injuries from anon, authenticated;

-- Officers' internal notes; reporters never see them.
create table public.incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incident_reports (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index incident_notes_incident_idx on public.incident_notes (incident_id, created_at);
alter table public.incident_notes enable row level security;
revoke update on public.incident_notes from anon, authenticated;
create policy "incident notes: officers read" on public.incident_notes
  for select to authenticated using (private.is_safety_officer());
create policy "incident notes: officers write" on public.incident_notes
  for insert to authenticated
  with check (private.is_safety_officer() and author_id = auth.uid());

-- Stores the encrypted injury text for a report the caller just filed (or, with the service
-- role, for a fully anonymous one). Only once, only with consent.
create function public.add_incident_injury(p_incident uuid, p_details_enc text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.incident_reports;
begin
  select * into v_row from public.incident_reports where id = p_incident;
  if v_row.id is null
     or (auth.uid() is not null and v_row.reporter_id is distinct from auth.uid())
     or not v_row.special_category_consent
     or v_row.created_at < now() - interval '10 minutes' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.incident_injuries (incident_id, details_enc) values (p_incident, p_details_enc);
end;
$$;
revoke execute on function public.add_incident_injury(uuid, text) from public, anon;
grant execute on function public.add_incident_injury(uuid, text) to authenticated;

-- Safety officers (audited) and the reporter can read the encrypted injury text.
create function public.read_incident_injury(p_incident uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_reporter uuid;
  v_enc text;
begin
  select reporter_id into v_reporter from public.incident_reports where id = p_incident;
  if not (private.is_safety_officer() or (v_reporter is not null and v_reporter = auth.uid())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select details_enc into v_enc from public.incident_injuries where incident_id = p_incident;
  if v_enc is not null and private.is_safety_officer() then
    perform private.audit('incident.read_injury', 'incident_reports', p_incident::text);
  end if;
  return v_enc;
end;
$$;
revoke execute on function public.read_incident_injury(uuid) from public, anon;
grant execute on function public.read_incident_injury(uuid) to authenticated;

-- Opening a report as a safety officer is audited.
create function public.log_incident_view(p_incident uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_safety_officer() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.audit('incident.view', 'incident_reports', p_incident::text);
end;
$$;
revoke execute on function public.log_incident_view(uuid) from public, anon;
grant execute on function public.log_incident_view(uuid) to authenticated;

-- Status changes are audited too.
create function private.audit_incident_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform private.audit('incident.status', 'incident_reports', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
    if new.status = 'closed' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status <> 'closed' then
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger incident_reports_status before update on public.incident_reports
  for each row execute function private.audit_incident_status();

-- Counts only, by year, category and severity: no site, date or person. Anyone may read them.
create function public.incident_stats()
returns table (year integer, category public.incident_category, severity public.incident_severity, reports bigint)
language sql stable security definer set search_path = '' as $$
  select extract(year from occurred_on)::int, category, severity, count(*)
  from public.incident_reports
  group by 1, 2, 3
  order by 1 desc, 4 desc;
$$;
grant execute on function public.incident_stats() to anon, authenticated;

-- After the retention period, closed reports lose everything that points to a person.
create function private.purge_incident_personal_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer;
begin
  select retain_days into v_days from public.retention_policies where data_type = 'incident_personal_details';
  with old as (
    select id from public.incident_reports
    where status = 'closed' and personal_data_purged_at is null
      and closed_at < now() - make_interval(days => coalesce(v_days, 365))
  ), gone as (
    delete from public.incident_injuries i using old where i.incident_id = old.id
  )
  update public.incident_reports r set
    reporter_id = null, assigned_to = null, contact_ok = false, personal_data_purged_at = now()
  from old where r.id = old.id;
end;
$$;
revoke execute on function private.purge_incident_personal_data() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safety lessons: anonymised write-ups that safety officers publish for everyone.
-- ---------------------------------------------------------------------------

create type public.lesson_status as enum ('draft', 'published');

create table public.safety_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  title text not null check (char_length(title) between 5 and 160),
  summary text check (char_length(summary) <= 400),
  body_md text not null check (char_length(body_md) <= 20000),
  category public.incident_category not null,
  severity public.incident_severity not null,
  status public.lesson_status not null default 'draft',
  author_id uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.safety_lessons enable row level security;
create trigger safety_lessons_updated_at before update on public.safety_lessons
  for each row execute function private.set_updated_at();

create policy "lessons: published for everyone" on public.safety_lessons
  for select to anon, authenticated using (status = 'published');
create policy "lessons: officers read all" on public.safety_lessons
  for select to authenticated using (private.is_safety_officer());
create policy "lessons: officers write" on public.safety_lessons
  for all to authenticated
  using (private.is_safety_officer()) with check (private.is_safety_officer());

-- Lessons are not linked to reports, so a published lesson can never lead back to a reporter.

insert into public.retention_policies (data_type, retain_days, description) values
  ('event_rsvps', 365, 'Event sign-ups are deleted this many days after the event.'),
  ('rides', 30, 'Carpool and retrieve posts are deleted this many days after the ride date.')
on conflict (data_type) do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-incident-personal-data', '35 3 * * *',
      'select private.purge_incident_personal_data()');
  end if;
end;
$$;
