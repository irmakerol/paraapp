-- Admin user detail page: one audited read of everything an admin needs about a member (profile,
-- flight summary, equipment, listings, notices), extra profile fields admins may correct, and
-- account deletion on the member's behalf through the same anonymise-then-purge path the member
-- uses. Full tracks, messages and the licence number itself are never part of this.

create function private.admin_may_manage(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() and (
    p_user = auth.uid() or private.is_super_admin() or not exists (
      select 1 from public.user_roles where user_id = p_user and role in ('admin', 'super_admin')
    )
  );
$$;
revoke execute on function private.admin_may_manage(uuid) from public, anon, authenticated;

create function public.admin_user_overview(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and status <> 'deletion_requested') then
    return null;
  end if;

  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) - 'field_privacy' - 'notification_prefs' - 'units'
        || jsonb_build_object(
          'licence_body', pp.licence_body,
          'has_licence_number', pp.licence_number_enc is not null)
      from public.profiles p
      left join public.profile_private pp on pp.user_id = p.id
      where p.id = p_user),
    'stats', (
      select jsonb_build_object(
        'flights', count(*),
        'seconds', coalesce(sum(duration_s), 0),
        'first', min(started_at),
        'last', max(started_at),
        'longest_s', max(duration_s),
        'max_distance_m', max(coalesce(xc_distance_m, distance_m)),
        'max_alt_m', max(max_alt_m))
      from public.flights where user_id = p_user),
    'flights', coalesce((
      select jsonb_agg(f order by f.started_at desc) from (
        select fl.id, fl.started_at, fl.duration_s, fl.distance_m, fl.xc_distance_m, fl.xc_points,
          fl.max_alt_m, fl.visibility, fl.source, fl.glider,
          coalesce(s.name, fl.site_name) as site
        from public.flights fl
        left join public.sites s on s.id = fl.takeoff_site_id
        where fl.user_id = p_user
        order by fl.started_at desc
        limit 200) f), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id, 'kind', e.kind, 'brand', e.brand, 'model', e.model, 'size', e.size,
          'certification', e.certification, 'last_check_on', e.last_check_on,
          'last_repack_on', e.last_repack_on, 'retired', e.retired)
        order by e.retired, e.kind)
      from public.equipment e where e.user_id = p_user), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'category', a.category, 'price', a.price,
          'currency', a.currency, 'status', a.status, 'removed', a.removed_at is not null,
          'created_at', a.created_at)
        order by a.created_at desc)
      from public.ads a where a.owner_id = p_user), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', n.id, 'title', n.title, 'category', n.category, 'kind', n.kind,
          'closed', n.closed, 'expires_at', n.expires_at, 'created_at', n.created_at)
        order by n.created_at desc)
      from public.notices n where n.user_id = p_user), '[]'::jsonb),
    'reports_about', (
      select count(*) from public.reports
      where target_type = 'user' and target_id = p_user)
  ) into v_result;

  perform private.audit('profile.admin_viewed', 'profiles', p_user::text, '{}'::jsonb);
  return v_result;
end;
$$;
revoke execute on function public.admin_user_overview(uuid) from public, anon;
grant execute on function public.admin_user_overview(uuid) to authenticated;

create function public.admin_update_profile_details(
  p_user uuid,
  p_country text,
  p_flying_since integer,
  p_licence_body text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.profiles;
  v_old_body text;
  v_changed text[] := '{}';
begin
  if not private.admin_may_manage(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_old from public.profiles where id = p_user for update;
  if not found or v_old.status = 'deletion_requested' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select licence_body into v_old_body from public.profile_private where user_id = p_user;

  if p_country is distinct from v_old.country then v_changed := array_append(v_changed, 'country'); end if;
  if p_flying_since is distinct from v_old.flying_since then v_changed := array_append(v_changed, 'flying_since'); end if;
  if p_licence_body is distinct from v_old_body then v_changed := array_append(v_changed, 'licence_body'); end if;

  update public.profiles set country = p_country, flying_since = p_flying_since where id = p_user;
  update public.profile_private set licence_body = p_licence_body where user_id = p_user;

  if cardinality(v_changed) > 0 then
    perform private.audit('profile.admin_edit', 'profiles', p_user::text,
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
end;
$$;
revoke execute on function public.admin_update_profile_details(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_update_profile_details(uuid, text, integer, text) to authenticated;

-- Same steps as request_account_deletion(), for a member an admin removes. The app server deletes
-- the member's files with the service role before calling this.
create function public.admin_request_account_deletion(p_user uuid, p_reason text)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer;
  v_purge timestamptz;
begin
  if not private.admin_may_manage(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.account_deletions where user_id = p_user and purged_at is null) then
    raise exception 'deletion_already_requested' using errcode = '22023';
  end if;

  select coalesce(retain_days, 30) into v_days
  from public.retention_policies where data_type = 'deleted_accounts';
  v_purge := now() + make_interval(days => coalesce(v_days, 30));

  insert into public.account_deletions (user_id, purge_after) values (p_user, v_purge);

  update public.profiles set
    display_name = 'Deleted user', full_name = null, avatar_path = null, country = null,
    city = null, home_site = null, pilot_level = null, years_flying = null, wings = null,
    bio = null, field_privacy = private.default_field_privacy('minor'),
    status = 'deletion_requested'
  where id = p_user;

  delete from public.profile_private where user_id = p_user;
  delete from public.guardian_consents where user_id = p_user;
  delete from public.user_roles where user_id = p_user;

  update auth.users set banned_until = 'infinity' where id = p_user;
  delete from auth.sessions where user_id = p_user;

  perform private.audit('account.deletion_by_admin', 'profiles', p_user::text,
    jsonb_build_object('purge_after', v_purge, 'reason', left(coalesce(p_reason, ''), 500)));
  return v_purge;
end;
$$;
revoke execute on function public.admin_request_account_deletion(uuid, text) from public, anon;
grant execute on function public.admin_request_account_deletion(uuid, text) to authenticated;
