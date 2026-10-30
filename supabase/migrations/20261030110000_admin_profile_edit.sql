-- Admins correct members' profiles (a misspelt name, a wrong level) and remove unsuitable profile
-- photos. Only through this function, so every change is audited; the photo file itself is
-- deleted by the app server afterwards. Only the super admin edits another admin's profile.

create function public.admin_update_profile(
  p_user uuid,
  p_display_name text,
  p_full_name text,
  p_city text,
  p_home_site text,
  p_pilot_level public.pilot_level,
  p_bio text,
  p_remove_photo boolean default false
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.profiles;
  v_changed text[] := '{}';
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user <> auth.uid() and not private.is_super_admin() and exists (
    select 1 from public.user_roles where user_id = p_user and role in ('admin', 'super_admin')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_old from public.profiles where id = p_user for update;
  if not found or v_old.status = 'deletion_requested' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_display_name is distinct from v_old.display_name then v_changed := array_append(v_changed, 'display_name'); end if;
  if p_full_name is distinct from v_old.full_name then v_changed := array_append(v_changed, 'full_name'); end if;
  if p_city is distinct from v_old.city then v_changed := array_append(v_changed, 'city'); end if;
  if p_home_site is distinct from v_old.home_site then v_changed := array_append(v_changed, 'home_site'); end if;
  if p_pilot_level is distinct from v_old.pilot_level then v_changed := array_append(v_changed, 'pilot_level'); end if;
  if p_bio is distinct from v_old.bio then v_changed := array_append(v_changed, 'bio'); end if;
  if p_remove_photo and v_old.avatar_path is not null then v_changed := array_append(v_changed, 'photo'); end if;

  update public.profiles set
    display_name = p_display_name,
    full_name = p_full_name,
    city = p_city,
    home_site = p_home_site,
    pilot_level = p_pilot_level,
    bio = p_bio,
    avatar_path = case when p_remove_photo then null else avatar_path end
  where id = p_user;

  if cardinality(v_changed) > 0 then
    perform private.audit('profile.admin_edit', 'profiles', p_user::text,
      jsonb_build_object('fields', to_jsonb(v_changed),
                         'old_display_name', v_old.display_name));
  end if;
  -- The removed photo's storage path, so the server can delete the file.
  return case when p_remove_photo then v_old.avatar_path end;
end;
$$;
revoke execute on function public.admin_update_profile(uuid, text, text, text, text, public.pilot_level, text, boolean)
  from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, public.pilot_level, text, boolean)
  to authenticated;
