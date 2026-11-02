begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ayse@example.com', '{"display_name":"Ayşe","birth_date":"1990-05-01"}');
insert into auth.sessions (id, user_id) values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111');
update public.profiles set bio = 'Thermal hunter' where id = '11111111-1111-1111-1111-111111111111';

-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
set local role anon;
select throws_ok($$ select public.request_account_deletion() $$, '42501', null, 'guests cannot call deletion');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select ok(public.request_account_deletion() > now() + interval '29 days', 'purge is scheduled 30 days out');
reset role;

select is((select display_name || coalesce(bio, '') from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Deleted user', 'profile is anonymised immediately');
select is((select count(*)::int from public.user_roles where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'roles are removed');
select is((select count(*)::int from auth.sessions where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'all sessions are ended');
select ok((select banned_until = 'infinity' from auth.users where id = '11111111-1111-1111-1111-111111111111'),
  'sign-in is blocked');

select is(private.purge_deleted_accounts(), 0, 'nothing is purged before the grace period');
update public.account_deletions set purge_after = now() - interval '1 minute';
select is(private.purge_deleted_accounts(), 1, 'account is purged after the grace period');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0,
  'purge cascades to profile data');

select * from finish();
rollback;
