-- Phase 1: equipment marketplace. No payments: the club is not a party to sales between members.

create type public.ad_category as enum (
  'wing', 'harness', 'reserve', 'instrument', 'helmet', 'radio', 'clothing', 'accessories', 'other'
);
create type public.ad_condition as enum ('new', 'like_new', 'good', 'fair', 'for_parts');
create type public.ad_status as enum ('active', 'reserved', 'sold', 'archived');
create type public.currency as enum ('TRY', 'EUR', 'USD');

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_club boolean not null default false,
  title text not null check (char_length(title) between 3 and 120),
  category public.ad_category not null,
  brand text check (char_length(brand) <= 60),
  model text check (char_length(model) <= 80),
  size text check (char_length(size) <= 20),
  weight_min smallint check (weight_min between 20 and 300),
  weight_max smallint check (weight_max between 20 and 300),
  year smallint check (year between 1980 and 2100),
  hours numeric(6, 1) check (hours >= 0),
  flights integer check (flights >= 0),
  -- EN/LTF class as written by the seller, e.g. "EN-B", "LTF 1-2", "CCC".
  certification text check (char_length(certification) <= 20),
  last_check_date date,
  reserve_repack_date date,
  condition public.ad_condition not null,
  price numeric(12, 2) not null check (price >= 0),
  currency public.currency not null default 'TRY',
  city text check (char_length(city) <= 80),
  location_text text check (char_length(location_text) <= 120),
  description text not null default '' check (char_length(description) <= 5000),
  status public.ad_status not null default 'active',
  expires_at timestamptz not null default now() + interval '60 days',
  renewal_reminded_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' ||
      coalesce(size, '') || ' ' || coalesce(description, ''))
  ) stored,
  check (weight_min is null or weight_max is null or weight_min <= weight_max)
);
create index ads_list_idx on public.ads (status, created_at desc);
create index ads_search_idx on public.ads using gin (search);
create index ads_owner_idx on public.ads (owner_id);
alter table public.ads enable row level security;
create trigger ads_updated_at before update on public.ads
  for each row execute function private.set_updated_at();

create function private.ad_visible(p_ad public.ads) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ad.removed_at is null
    and p_ad.status in ('active', 'reserved', 'sold')
    and p_ad.expires_at > now();
$$;

-- Owners may not change moderation fields, the club badge or the expiry directly.
revoke insert, update on public.ads from anon, authenticated;
grant insert (
  id, owner_id, title, category, brand, model, size, weight_min, weight_max, year, hours, flights,
  certification, last_check_date, reserve_repack_date, condition, price, currency, city,
  location_text, description, is_club
) on public.ads to authenticated;
grant update (
  title, category, brand, model, size, weight_min, weight_max, year, hours, flights,
  certification, last_check_date, reserve_repack_date, condition, price, currency, city,
  location_text, description, status
) on public.ads to authenticated;
grant update (removed_at, removed_by, is_club) on public.ads to authenticated;

create policy "ads: read visible" on public.ads
  for select to anon, authenticated using (private.ad_visible(ads));
create policy "ads: owners read own" on public.ads
  for select to authenticated using (owner_id = auth.uid());
create policy "ads: moderators read all" on public.ads
  for select to authenticated using (private.is_moderator());
-- Minors cannot post ads. Only admins can post as the club.
create policy "ads: adults post" on public.ads
  for insert to authenticated
  with check (
    owner_id = auth.uid() and private.is_active_user() and private.is_adult()
    and (not is_club or private.is_admin())
  );
create policy "ads: owners edit" on public.ads
  for update to authenticated
  using (owner_id = auth.uid() and removed_at is null)
  with check (owner_id = auth.uid() and removed_at is null and (not is_club or private.is_admin()));
create policy "ads: moderators moderate" on public.ads
  for update to authenticated using (private.is_moderator()) with check (private.is_moderator());
create policy "ads: owners delete" on public.ads
  for delete to authenticated using (owner_id = auth.uid());
create policy "ads: moderators delete" on public.ads
  for delete to authenticated using (private.is_moderator());

-- Renewal keeps the 60-day rule in one place.
create function public.renew_ad(p_ad uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_expires timestamptz := now() + interval '60 days';
begin
  update public.ads
  set expires_at = v_expires,
      renewal_reminded_at = null,
      status = case when status = 'archived' then 'active' else status end
  where id = p_ad and owner_id = auth.uid() and removed_at is null and status <> 'sold';
  if not found then
    raise exception 'ad_not_renewable' using errcode = '22023';
  end if;
  return v_expires;
end;
$$;
revoke execute on function public.renew_ad(uuid) from public, anon;
grant execute on function public.renew_ad(uuid) to authenticated;

create table public.ad_photos (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  path text not null,
  position smallint not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  unique (ad_id, position)
);
alter table public.ad_photos enable row level security;

create function private.owns_ad(p_ad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ads where id = p_ad and owner_id = auth.uid());
$$;

create policy "ad photos: read with ad" on public.ad_photos
  for select to anon, authenticated
  using (exists (select 1 from public.ads a where a.id = ad_id));
create policy "ad photos: owners manage" on public.ad_photos
  for all to authenticated
  using (private.owns_ad(ad_id))
  with check (private.owns_ad(ad_id) and path like auth.uid()::text || '/%');

-- At most 8 photos per ad.
create function private.limit_ad_photos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.ad_photos where ad_id = new.ad_id) >= 8 then
    raise exception 'too_many_photos' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger ad_photos_limit before insert on public.ad_photos
  for each row execute function private.limit_ad_photos();

-- Photos are public (they illustrate public ads) and stripped of EXIF in the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-photos', 'ad-photos', true, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "ad-photos: owner manages own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'ad-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'ad-photos' and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_user() and private.is_adult()
  );

-- Saved searches/favourites come later; in-app notifications are used for reminders.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Daily: remind 7 days before expiry, archive expired ads, delete long-archived ones.
create function private.process_ad_expiry() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer;
begin
  insert into public.notifications (user_id, kind, payload)
  select owner_id, 'ad_expiring', jsonb_build_object('ad_id', id, 'title', title, 'expires_at', expires_at)
  from public.ads
  where status in ('active', 'reserved') and removed_at is null
    and renewal_reminded_at is null and expires_at < now() + interval '7 days';

  update public.ads set renewal_reminded_at = now()
  where status in ('active', 'reserved') and removed_at is null
    and renewal_reminded_at is null and expires_at < now() + interval '7 days';

  update public.ads set status = 'archived'
  where status in ('active', 'reserved') and expires_at <= now();

  select retain_days into v_days from public.retention_policies where data_type = 'expired_ads';
  if v_days is not null then
    delete from public.ads
    where status in ('archived', 'sold') and updated_at < now() - make_interval(days => v_days);
  end if;
end;
$$;
revoke execute on function private.process_ad_expiry() from public, anon, authenticated;
