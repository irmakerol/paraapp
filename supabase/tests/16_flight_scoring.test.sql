begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active';
insert into public.flights (id, user_id, started_at, duration_s, source, visibility, xc_type, xc_distance_m, xc_points) values
  ('f2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', 5400,
   'igc', 'public', 'fai', 42000, 58.8);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ update public.flights set xc_points = 999 where id = 'f2000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'pilots cannot change their own score');
select lives_ok($$ update public.flights set notes = 'Nice day' where id = 'f2000000-0000-0000-0000-000000000001' $$,
  'pilots can still edit their notes');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select xc_points from public.flights where id = 'f2000000-0000-0000-0000-000000000001'), 58.80::numeric,
  'other people see the score of a public flight');
select throws_ok($$ update public.flights set xc_type = 'free' where id = 'f2000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'nobody else can change it either');
reset role;

select * from finish();
rollback;
