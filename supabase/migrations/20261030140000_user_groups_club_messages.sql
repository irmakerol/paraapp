-- User groups (e.g. "Öğrenciler 2026", "Tandem ekibi") kept by admins, and club messages the super
-- admin sends to everyone, to one role or to one group (Irmak, 2026-10-30). Recipients are fixed
-- when a message is sent; each person sees only the messages they received.

create table public.user_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.user_groups enable row level security;
revoke all on public.user_groups from anon;
revoke insert, update, delete on public.user_groups from authenticated;
grant insert (name, description, created_by), update (name, description), delete
  on public.user_groups to authenticated;

create table public.user_group_members (
  group_id uuid not null references public.user_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index user_group_members_user_idx on public.user_group_members (user_id);
alter table public.user_group_members enable row level security;
revoke all on public.user_group_members from anon;
revoke insert, update, delete on public.user_group_members from authenticated;
grant insert (group_id, user_id, added_by), delete on public.user_group_members to authenticated;

create policy "user groups: admins manage" on public.user_groups
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin() and created_by = auth.uid());
create policy "user groups: members read theirs" on public.user_groups
  for select to authenticated using (
    exists (select 1 from public.user_group_members m where m.group_id = id and m.user_id = auth.uid())
  );
create policy "group members: admins manage" on public.user_group_members
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin() and added_by = auth.uid());
create policy "group members: read own" on public.user_group_members
  for select to authenticated using (user_id = auth.uid());

create table public.club_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users (id) on delete set null,
  audience text not null check (audience in ('all', 'role', 'group')),
  audience_role public.app_role,
  audience_group uuid references public.user_groups (id) on delete set null,
  -- Kept so the sent list still says who it went to after a group is deleted.
  audience_label text,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  check (audience <> 'role' or audience_role is not null),
  check (audience <> 'group' or audience_label is not null)
);
alter table public.club_messages enable row level security;
revoke all on public.club_messages from anon;
revoke insert, update, delete on public.club_messages from authenticated;

create table public.club_message_recipients (
  message_id uuid not null references public.club_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index club_message_recipients_user_idx on public.club_message_recipients (user_id);
alter table public.club_message_recipients enable row level security;
revoke all on public.club_message_recipients from anon;
revoke insert, update, delete on public.club_message_recipients from authenticated;
grant update (read_at) on public.club_message_recipients to authenticated;

create policy "club messages: super admin reads all" on public.club_messages
  for select to authenticated using (private.is_super_admin());
create policy "club messages: recipients read" on public.club_messages
  for select to authenticated using (
    exists (select 1 from public.club_message_recipients r
            where r.message_id = id and r.user_id = auth.uid())
  );
create policy "club recipients: own" on public.club_message_recipients
  for select to authenticated using (user_id = auth.uid() or private.is_super_admin());
create policy "club recipients: mark read" on public.club_message_recipients
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sends a club message: only the super admin. Goes to active accounts only. Returns the message id.
create function public.send_club_message(
  p_audience text,
  p_role public.app_role,
  p_group uuid,
  p_title text,
  p_body text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_label text;
  v_count integer;
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_audience = 'group' then
    select name into v_label from public.user_groups where id = p_group;
    if v_label is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.club_messages (sender_id, audience, audience_role, audience_group,
                                    audience_label, title, body)
  values (auth.uid(), p_audience,
          case when p_audience = 'role' then p_role end,
          case when p_audience = 'group' then p_group end,
          v_label, trim(p_title), trim(p_body))
  returning id into v_id;

  insert into public.club_message_recipients (message_id, user_id)
  select v_id, p.id
  from public.profiles p
  where p.status = 'active'
    and (p_audience = 'all'
      or (p_audience = 'role' and exists (
            select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
      or (p_audience = 'group' and exists (
            select 1 from public.user_group_members m where m.user_id = p.id and m.group_id = p_group)));
  get diagnostics v_count = row_count;

  update public.club_messages set recipient_count = v_count where id = v_id;
  perform private.audit('club_message.send', 'club_messages', v_id::text,
    jsonb_build_object('audience', p_audience, 'role', p_role, 'group', p_group,
                       'recipients', v_count));
  return v_id;
end;
$$;
revoke execute on function public.send_club_message(text, public.app_role, uuid, text, text) from public, anon;
grant execute on function public.send_club_message(text, public.app_role, uuid, text, text) to authenticated;
