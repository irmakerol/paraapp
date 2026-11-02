-- Super admin: always also holds "admin" (so every admin policy applies) and is the only role
-- that can grant or revoke "admin" and "super_admin". Guides count as members.

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin');
$$;

create or replace function private.is_member_level(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user
      and role in ('member', 'instructor', 'guide', 'moderator', 'safety_officer',
                   'trip_organiser', 'admin', 'super_admin')
  );
$$;

-- Granting super_admin also grants admin; losing admin also removes super_admin.
create function private.super_admin_implies_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_roles (user_id, role, granted_by)
    values (new.user_id, 'admin', new.granted_by)
    on conflict do nothing;
    return new;
  end if;
  delete from public.user_roles where user_id = old.user_id and role = 'super_admin';
  return old;
end;
$$;
revoke execute on function private.super_admin_implies_admin() from public, anon, authenticated;

create trigger user_roles_super_admin_grant
  after insert on public.user_roles
  for each row when (new.role = 'super_admin')
  execute function private.super_admin_implies_admin();
create trigger user_roles_admin_revoke
  after delete on public.user_roles
  for each row when (old.role = 'admin')
  execute function private.super_admin_implies_admin();

drop policy "roles: admins grant" on public.user_roles;
drop policy "roles: admins revoke" on public.user_roles;

create policy "roles: admins grant" on public.user_roles
  for insert to authenticated with check (
    private.is_admin() and granted_by = auth.uid()
    and (role not in ('admin', 'super_admin') or private.is_super_admin())
  );
-- Nobody removes their own admin or super admin role (the club must not lock itself out).
create policy "roles: admins revoke" on public.user_roles
  for delete to authenticated using (
    private.is_admin()
    and (role not in ('admin', 'super_admin')
         or (private.is_super_admin() and user_id <> auth.uid()))
  );

grant execute on function private.is_super_admin() to anon, authenticated, service_role;
