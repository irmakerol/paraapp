begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'b@example.com', '{"birth_date":"1990-01-01"}'),
  ('88888888-8888-8888-8888-888888888888', 'mod@example.com', '{"birth_date":"1985-01-01"}');
-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values ('88888888-8888-8888-8888-888888888888', 'moderator');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
create temp table t_chat as select public.start_direct_chat('33333333-3333-3333-3333-333333333333') as id;
grant select on t_chat to authenticated;
create temp table t_msg (id uuid);
grant select, insert on t_msg to authenticated;
with m as (
  insert into public.messages (chat_id, sender_id, body)
  values ((select id from t_chat), '11111111-1111-1111-1111-111111111111', 'Regrettable message')
  returning id
)
insert into t_msg select id from m;

update public.messages set deleted_at = now() where id = (select id from t_msg);

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select body from public.messages where id = (select id from t_msg)), null,
  'the other member can no longer read deleted content');
select is((select deleted_at is not null from public.messages where id = (select id from t_msg)), true,
  'the message shows as deleted');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.messages set deleted_at = null where id = (select id from t_msg);
select is((select deleted_at is not null from public.messages where id = (select id from t_msg)), true,
  'deletion cannot be undone');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
create temp table t_report (id uuid);
grant select, insert on t_report to authenticated;
with r as (
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('33333333-3333-3333-3333-333333333333', 'message', (select id from t_msg), 'harassment')
  returning id
)
insert into t_report select id from r;

select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select is((select body from public.reported_chat_messages((select id from t_report)) limit 1),
  'Regrettable message', 'moderators still see deleted content of a reported chat');

reset role;
select is((select count(*)::int from private.deleted_message_content), 1, 'a copy is kept for moderation');
update private.deleted_message_content set deleted_at = now() - interval '31 days';
select private.purge_deleted_message_content();
select is((select count(*)::int from private.deleted_message_content), 0, 'and purged after 30 days');

select * from finish();
rollback;
