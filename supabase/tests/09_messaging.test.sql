begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'b@example.com', '{"birth_date":"1990-01-01"}'),
  ('55555555-5555-5555-5555-555555555555', 'c@example.com', '{"birth_date":"1990-01-01"}'),
  ('88888888-8888-8888-8888-888888888888', 'mod@example.com', '{"birth_date":"1985-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active' where id = '44444444-4444-4444-4444-444444444444';
insert into public.user_roles (user_id, role) values ('88888888-8888-8888-8888-888888888888', 'moderator');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
create temp table t_chat as select public.start_direct_chat('33333333-3333-3333-3333-333333333333') as id;
grant select on t_chat to authenticated;
select is(public.start_direct_chat('33333333-3333-3333-3333-333333333333'), (select id from t_chat),
  'the same direct chat is reused');
select lives_ok($$ insert into public.messages (chat_id, sender_id, body)
  values ((select id from t_chat), '11111111-1111-1111-1111-111111111111', 'Is the wing still available?') $$,
  'members can send');
select throws_ok($$ insert into public.messages (chat_id, sender_id, body)
  values ((select id from t_chat), '33333333-3333-3333-3333-333333333333', 'Spoofed') $$,
  '42501', null, 'cannot send as someone else');
select throws_ok($$ select public.start_direct_chat('44444444-4444-4444-4444-444444444444') $$,
  '42501', 'minor_protected', 'adults cannot open a chat with a minor');

-- Outsider
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, 'outsiders cannot read the chat');
select throws_ok($$ insert into public.messages (chat_id, sender_id, body)
  values ((select id from t_chat), '55555555-5555-5555-5555-555555555555', 'Hi') $$,
  '42501', null, 'outsiders cannot post into the chat');

-- Moderator without a report
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, 'moderators cannot browse private chats');

-- Recipient reads, then blocks
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 1, 'the other member reads the message');
select lives_ok($$ update public.chat_members set last_read_at = now()
  where chat_id = (select id from t_chat) and user_id = '33333333-3333-3333-3333-333333333333' $$,
  'read receipts');
insert into public.blocks (blocker_id, blocked_id) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');
create temp table t_report (id uuid);
with r as (
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('33333333-3333-3333-3333-333333333333', 'chat', (select id from t_chat), 'harassment')
  returning id
)
insert into t_report select id from r;
grant select on t_report to authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.messages (chat_id, sender_id, body)
  values ((select id from t_chat), '11111111-1111-1111-1111-111111111111', 'Hello?') $$,
  '42501', null, 'blocked users cannot keep messaging');

-- Minor can reach out to an adult
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ select public.start_direct_chat('55555555-5555-5555-5555-555555555555') $$,
  'a minor may contact an adult');

-- Moderator with a report
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select is((select count(*)::int from public.reported_chat_messages((select id from t_report))), 1,
  'moderators can read a reported chat');
reset role;
select is((select action from public.audit_log where action = 'moderation.read_chat'), 'moderation.read_chat',
  'reading a reported chat is audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok($$ select * from public.reported_chat_messages((select id from t_report)) $$,
  '42501', null, 'non-moderators cannot use the report view');
select throws_ok($$ select public.ban_user('11111111-1111-1111-1111-111111111111', now() + interval '1 day', 'x') $$,
  '42501', null, 'non-moderators cannot ban');

select * from finish();
rollback;
