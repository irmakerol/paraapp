-- Student pilots record the level they are training for (e.g. P3 → training for P4). Only levels
-- above the current one are allowed, in the order the forms list them:
-- P2 < P3 < P4 < P5 < T1 < T2 < T3 (legacy: student and P1 below P2, tandem with T1).
-- Must match trainingLevelOptions() in packages/core/src/schemas.ts.

create function private.level_order(p_level public.pilot_level) returns integer
language sql immutable set search_path = '' as $$
  select case p_level::text
    when 'student' then 0 when 'p1' then 1 when 'p2' then 2 when 'p3' then 3
    when 'p4' then 4 when 'p5' then 5 when 't1' then 6 when 'tandem' then 6
    when 't2' then 7 when 't3' then 8 when 'instructor' then 9
  end;
$$;

create function private.training_level_ok(p_current public.pilot_level, p_target public.pilot_level)
returns boolean language sql immutable set search_path = '' as $$
  select p_target is null
    or (p_target::text in ('p2', 'p3', 'p4', 'p5', 't1', 't2', 't3')
        and private.level_order(p_target) > coalesce(private.level_order(p_current), -1));
$$;
-- Both are pure (no table access) and run in the check constraint as the signed-in user.

alter table public.profiles add column training_level public.pilot_level;
grant update (training_level) on public.profiles to authenticated;

-- Reaching (or passing) the target clears it, so a level change never fails because of it.
create function private.clear_reached_training_level() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.pilot_level is distinct from old.pilot_level
     and new.training_level is not distinct from old.training_level
     and not private.training_level_ok(new.pilot_level, new.training_level) then
    new.training_level := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.clear_reached_training_level() from public, anon, authenticated;

create trigger profiles_clear_reached_training_level
  before update of pilot_level on public.profiles
  for each row execute function private.clear_reached_training_level();

alter table public.profiles add constraint profiles_training_level_above
  check (private.training_level_ok(pilot_level, training_level));

-- Admins set it on the user detail page (audited, same rules as other admin edits).
create function public.admin_set_training_level(p_user uuid, p_level public.pilot_level) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.pilot_level;
begin
  if not private.admin_may_manage(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select training_level into v_old from public.profiles
  where id = p_user and status <> 'deletion_requested' for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old is distinct from p_level then
    update public.profiles set training_level = p_level where id = p_user;
    perform private.audit('profile.admin_edit', 'profiles', p_user::text,
      jsonb_build_object('fields', jsonb_build_array('training_level')));
  end if;
end;
$$;
revoke execute on function public.admin_set_training_level(uuid, public.pilot_level) from public, anon;
grant execute on function public.admin_set_training_level(uuid, public.pilot_level) to authenticated;
