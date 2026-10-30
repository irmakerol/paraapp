begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'owner@example.com', '{"birth_date":"1980-01-01"}'),
  ('a2222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('a3333333-3333-3333-3333-333333333333', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('a4444444-4444-4444-4444-444444444444', 'admin2@example.com', '{"birth_date":"1985-01-01"}');
update public.profiles set status = 'active';
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values
  ('a1111111-1111-1111-1111-111111111111', 'super_admin'),
  ('a2222222-2222-2222-2222-222222222222', 'admin'),
  ('a4444444-4444-4444-4444-444444444444', 'admin');
insert into public.flights (user_id, started_at, duration_s, source)
  values ('a3333333-3333-3333-3333-333333333333', now() - interval '1 day', 3600, 'manual'),
         ('a3333333-3333-3333-3333-333333333333', now(), 1800, 'manual');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.admin_user_overview('a4444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'members cannot read the overview');
select throws_ok($$ select public.admin_request_account_deletion('a4444444-4444-4444-4444-444444444444', 'x') $$,
  '42501', null, 'members cannot delete accounts');

select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((public.admin_user_overview('a3333333-3333-3333-3333-333333333333') -> 'stats' ->> 'seconds')::int, 5400,
  'admins see the flight summary');
select is(jsonb_array_length(public.admin_user_overview('a3333333-3333-3333-3333-333333333333') -> 'flights'), 2,
  'and the flight list');
select ok(not (public.admin_user_overview('a3333333-3333-3333-3333-333333333333') -> 'flights' -> 0 ? 'public_track'),
  'without any track');
select lives_ok($$ select public.admin_update_profile_details('a3333333-3333-3333-3333-333333333333', 'DE', 2015, 'dhv') $$,
  'admins correct country, flying since and licence body');
select throws_ok($$ select public.admin_update_profile_details('a4444444-4444-4444-4444-444444444444', 'DE', 2015, null) $$,
  '42501', null, 'but not another admin''s');
select throws_ok($$ select public.admin_request_account_deletion('a4444444-4444-4444-4444-444444444444', 'x') $$,
  '42501', null, 'admins cannot delete another admin');
select lives_ok($$ select public.admin_request_account_deletion('a3333333-3333-3333-3333-333333333333', 'spam') $$,
  'admins delete a member account');
reset role;
select is((select status::text from public.profiles where id = 'a3333333-3333-3333-3333-333333333333'),
  'deletion_requested', 'the account goes through the usual anonymise-then-purge path');
select is((select count(*)::int from public.audit_log
  where action in ('profile.admin_viewed', 'profile.admin_edit', 'account.deletion_by_admin')
    and target_id = 'a3333333-3333-3333-3333-333333333333'), 5, 'views, edits and the deletion are audited');

select * from finish();
rollback;
