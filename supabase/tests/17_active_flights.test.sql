begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.active_flights (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  'a pilot can mark themselves as flying');
select lives_ok($$ update public.active_flights set updated_at = now() $$, 'and keep the row fresh');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*) from public.active_flights)::int, 0, 'other users cannot see it');
select throws_ok($$ insert into public.active_flights (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'or mark someone else as flying');
delete from public.active_flights;
reset role;
select is((select count(*) from public.active_flights)::int, 1, 'or delete it');

set local role anon;
select throws_ok($$ select * from public.active_flights $$, '42501', null, 'guests have no access');
reset role;

select * from finish();
rollback;
