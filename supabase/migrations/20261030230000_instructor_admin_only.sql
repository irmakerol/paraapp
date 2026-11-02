-- Only admins set the instructor rating (Irmak, 2026-10-30), through admin_set_instructor().
-- The column grant stays so older phone app builds, which still send is_instructor with the rest
-- of the profile, can save; this trigger keeps the old value for any direct user update.

create function private.keep_instructor_flag() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_instructor := old.is_instructor;
  end if;
  return new;
end;
$$;
revoke execute on function private.keep_instructor_flag() from public, anon, authenticated;

create trigger keep_instructor_flag
  before update of is_instructor on public.profiles
  for each row execute function private.keep_instructor_flag();
