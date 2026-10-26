-- Phase 1: blocks, reports, bans, 1-to-1 chat (group-ready), web push subscriptions.

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create policy "blocks: own" on public.blocks
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create function private.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Reports (moderation queue)
-- ---------------------------------------------------------------------------

create type public.report_target as enum ('ad', 'user', 'chat', 'message', 'news_comment', 'tip');
create type public.report_reason as enum (
  'spam', 'scam', 'harassment', 'hate', 'sexual', 'dangerous', 'illegal', 'other'
);
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolution_note text,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at);
alter table public.reports enable row level security;
revoke update on public.reports from anon, authenticated;
grant update (status, resolution_note, handled_by, handled_at) on public.reports to authenticated;

create policy "reports: file as self" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and handled_by is null);
create policy "reports: read own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "reports: moderators read" on public.reports
  for select to authenticated using (private.is_moderator());
create policy "reports: moderators handle" on public.reports
  for update to authenticated using (private.is_moderator()) with check (private.is_moderator());

-- ---------------------------------------------------------------------------
-- Bans (moderators): blocks sign-in until a date, audited
-- ---------------------------------------------------------------------------

create function public.ban_user(p_user uuid, p_until timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_ban_self' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') then
    raise exception 'cannot_ban_admin' using errcode = '42501';
  end if;
  update auth.users set banned_until = p_until where id = p_user;
  if p_until is null or p_until > now() then
    delete from auth.sessions where user_id = p_user;
  end if;
  perform private.audit(
    case when p_until is null then 'user.unban' else 'user.ban' end,
    'auth.users', p_user::text, jsonb_build_object('until', p_until, 'reason', p_reason)
  );
end;
$$;
revoke execute on function public.ban_user(uuid, timestamptz, text) from public, anon;
grant execute on function public.ban_user(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------

create type public.chat_kind as enum ('direct', 'group');

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_kind not null default 'direct',
  title text check (char_length(title) <= 80),
  ad_id uuid references public.ads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.chats enable row level security;
revoke insert, update, delete on public.chats from anon, authenticated;

create table public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (chat_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);
alter table public.chat_members enable row level security;
revoke insert, update, delete on public.chat_members from anon, authenticated;
grant update (last_read_at, muted) on public.chat_members to authenticated;

create function private.is_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members where chat_id = p_chat and user_id = auth.uid());
$$;

create policy "chats: members read" on public.chats
  for select to authenticated using (private.is_chat_member(id));
create policy "chat members: members read" on public.chat_members
  for select to authenticated using (private.is_chat_member(chat_id));
create policy "chat members: update own" on public.chat_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  body text check (char_length(body) <= 4000),
  image_path text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or image_path is not null or (lat is not null and lng is not null)),
  check ((lat is null) = (lng is null))
);
create index messages_chat_idx on public.messages (chat_id, created_at desc);
alter table public.messages enable row level security;
revoke update on public.messages from anon, authenticated;
grant update (deleted_at) on public.messages to authenticated;

-- Another member of a direct chat (null for groups).
create function private.direct_peer(p_chat uuid, p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.chat_members m
  join public.chats c on c.id = m.chat_id
  where m.chat_id = p_chat and c.kind = 'direct' and m.user_id <> p_user
  limit 1;
$$;

create policy "messages: members read" on public.messages
  for select to authenticated using (private.is_chat_member(chat_id));
create policy "messages: members send" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and deleted_at is null
    and private.is_chat_member(chat_id)
    and private.is_active_user()
    and not coalesce(private.is_blocked_between(auth.uid(), private.direct_peer(chat_id, auth.uid())), false)
    and (image_path is null or image_path like chat_id::text || '/%')
  );
-- "Delete for everyone" keeps the row (for reports) but hides the content in the app.
create policy "messages: sender deletes" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create function private.touch_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  update public.chat_members set last_read_at = new.created_at
  where chat_id = new.chat_id and user_id = new.sender_id;
  return new;
end;
$$;
create trigger messages_touch_chat after insert on public.messages
  for each row execute function private.touch_chat();

-- Simple flood protection: at most 30 messages per minute per sender.
create function private.rate_limit_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function private.rate_limit_messages();

-- Starts (or reuses) a direct chat. Rules: both active, not blocked, and adults cannot open
-- a chat with a minor (a minor may contact an adult, e.g. an instructor or a seller).
create function public.start_direct_chat(p_other uuid, p_ad uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
begin
  if v_me is null or not private.is_active_user(v_me) then
    raise exception 'not_active' using errcode = '42501';
  end if;
  if p_other = v_me or not private.is_active_user(p_other) then
    raise exception 'invalid_recipient' using errcode = '22023';
  end if;
  if private.is_blocked_between(v_me, p_other) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if private.is_adult(v_me) and not private.is_adult(p_other) then
    raise exception 'minor_protected' using errcode = '42501';
  end if;

  select c.id into v_chat
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = v_me
  join public.chat_members b on b.chat_id = c.id and b.user_id = p_other
  where c.kind = 'direct' and c.ad_id is not distinct from p_ad
  limit 1;

  if v_chat is null then
    insert into public.chats (kind, ad_id, created_by) values ('direct', p_ad, v_me)
    returning id into v_chat;
    insert into public.chat_members (chat_id, user_id) values (v_chat, v_me), (v_chat, p_other);
  end if;
  return v_chat;
end;
$$;
revoke execute on function public.start_direct_chat(uuid, uuid) from public, anon;
grant execute on function public.start_direct_chat(uuid, uuid) to authenticated;

-- Moderators see a conversation only when it has been reported, and every look is audited.
create function public.reported_chat_messages(p_report uuid)
returns setof public.messages
language plpgsql security definer set search_path = '' as $$
declare
  v_chat uuid;
begin
  if not private.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select case r.target_type
           when 'chat' then r.target_id
           when 'message' then (select m.chat_id from public.messages m where m.id = r.target_id)
         end
  into v_chat
  from public.reports r
  where r.id = p_report and r.target_type in ('chat', 'message');
  if v_chat is null then
    raise exception 'not_a_chat_report' using errcode = '22023';
  end if;
  perform private.audit('moderation.read_chat', 'chats', v_chat::text, jsonb_build_object('report_id', p_report));
  return query select * from public.messages where chat_id = v_chat order by created_at;
end;
$$;
revoke execute on function public.reported_chat_messages(uuid) from public, anon;
grant execute on function public.reported_chat_messages(uuid) to authenticated;

-- Chat images: private bucket, folder per chat, members only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "chat-media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and private.is_chat_member(((storage.foldername(name))[1])::uuid));
create policy "chat-media: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and private.is_chat_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Web push
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create policy "push: own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Per-topic notification settings. Club news pushes also need marketing consent.
alter table public.profiles
  add column notification_prefs jsonb not null
  default '{"messages": true, "news": true, "ads": true}'::jsonb;
grant update (notification_prefs) on public.profiles to authenticated;

-- Realtime: deliver new messages and read receipts (RLS still applies to subscribers).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.chat_members;
  end if;
end $$;

-- Daily marketplace job (guarded like the Phase 0 jobs).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('process-ad-expiry', '0 4 * * *', 'select private.process_ad_expiry()');
  end if;
end $$;
