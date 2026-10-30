-- Irmak (2026-10-30): Ground School (tips) content comes only from instructors, moderators and the
-- super admin (pilots no longer suggest tips; plain admins no longer edit them). Flying sites are
-- added, edited and deleted only by the super admin.

create or replace function private.is_tip_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('instructor', 'moderator', 'super_admin')
  );
$$;

drop policy "tips: pilots suggest" on public.tips;
drop policy "tips: authors edit unpublished" on public.tips;

drop policy "sites: moderators manage" on public.sites;
create policy "sites: super admin manages" on public.sites
  for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
