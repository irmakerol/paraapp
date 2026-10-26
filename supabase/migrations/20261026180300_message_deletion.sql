-- "Delete for everyone" really removes the content from the other person's view (not just in
-- the app). A copy is kept for 30 days so moderators can still act on a report about it, then
-- it is purged.

create table private.deleted_message_content (
  message_id uuid primary key references public.messages (id) on delete cascade,
  body text,
  image_path text,
  lat double precision,
  lng double precision,
  deleted_at timestamptz not null default now()
);

-- Deleted messages have no content any more.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%image_path IS NOT NULL%'
  loop
    execute format('alter table public.messages drop constraint %I', v_name);
  end loop;
end $$;
alter table public.messages add constraint messages_has_content check (
  deleted_at is not null or body is not null or image_path is not null
  or (lat is not null and lng is not null)
);

create function private.strip_deleted_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is not null then
    -- Deletion is final.
    new.deleted_at := old.deleted_at;
    return new;
  end if;
  if new.deleted_at is not null then
    insert into private.deleted_message_content (message_id, body, image_path, lat, lng, deleted_at)
    values (old.id, old.body, old.image_path, old.lat, old.lng, new.deleted_at)
    on conflict (message_id) do nothing;
    new.body := null;
    new.image_path := null;
    new.lat := null;
    new.lng := null;
  end if;
  return new;
end;
$$;
create trigger messages_strip_deleted before update on public.messages
  for each row execute function private.strip_deleted_message();

-- Moderators reviewing a report still see what was deleted (audited, as before).
create or replace function public.reported_chat_messages(p_report uuid)
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
  return query
    select m.id, m.chat_id, m.sender_id,
           coalesce(m.body, d.body), coalesce(m.image_path, d.image_path),
           coalesce(m.lat, d.lat), coalesce(m.lng, d.lng),
           m.deleted_at, m.created_at
    from public.messages m
    left join private.deleted_message_content d on d.message_id = m.id
    where m.chat_id = v_chat
    order by m.created_at;
end;
$$;

insert into public.retention_policies (data_type, retain_days, description) values
  ('deleted_message_content', 30, 'Content of messages deleted "for everyone" is kept this many days for moderation, then purged.')
on conflict (data_type) do nothing;

create function private.purge_deleted_message_content() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer;
begin
  select retain_days into v_days from public.retention_policies where data_type = 'deleted_message_content';
  if v_days is not null then
    delete from private.deleted_message_content where deleted_at < now() - make_interval(days => v_days);
  end if;
end;
$$;
revoke execute on function private.purge_deleted_message_content() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-deleted-messages', '30 4 * * *', 'select private.purge_deleted_message_content()');
  end if;
end $$;
