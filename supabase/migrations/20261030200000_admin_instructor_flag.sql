-- "Instructor" is the tick box now, never the pilot level. People whose level was still the old
-- 'instructor' value keep the claim through the box and have no level until they pick one.
-- Admins can set the box on the user detail page (audited, same rules as other admin edits).

update public.profiles set is_instructor = true, pilot_level = null
where pilot_level = 'instructor';

create function public.admin_set_instructor(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old boolean;
begin
  if not private.admin_may_manage(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select is_instructor into v_old from public.profiles
  where id = p_user and status <> 'deletion_requested' for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old is distinct from p_on then
    update public.profiles set is_instructor = p_on where id = p_user;
    perform private.audit('profile.admin_edit', 'profiles', p_user::text,
      jsonb_build_object('fields', jsonb_build_array('is_instructor')));
  end if;
end;
$$;
revoke execute on function public.admin_set_instructor(uuid, boolean) from public, anon;
grant execute on function public.admin_set_instructor(uuid, boolean) to authenticated;
