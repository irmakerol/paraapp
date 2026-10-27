begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active';

select is((select field_privacy ->> 'weight' from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'private', 'weight is private by default');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.profiles set pilot_level = 't2', flying_since = extract(year from now())::smallint - 6,
  weight_kg = 82, total_flight_hours = 120.5, total_flights = 340 where id = auth.uid() $$, 'pilots fill in the new fields');
reset role;
insert into public.flights (id, user_id, started_at, duration_s, source) values
  ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', 5400, 'manual'),
  ('f1000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', now() - interval '1 day', 3600, 'manual');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.add_flights_to_totals(array['f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000002']::uuid[]), 1, 'pilots add their own flights to their totals, once each');
select is((select total_flights from public.profiles where id = auth.uid()), 341, 'the flight count goes up by one');
select is((select total_flight_hours from public.profiles where id = auth.uid()), 122.0::numeric, 'the hours go up by the flight time');
select is(public.add_flights_to_totals(array['f1000000-0000-0000-0000-000000000001']::uuid[]), 0, 'a flight is never counted twice');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select weight_kg from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'), null,
  'other people do not see a private weight');
select is((select years_flying::int from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'), 6,
  'years flying is worked out from the year they started');
select is((select total_flights from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'), 341,
  'flight totals are public by default for adults');
update public.profiles set total_flights = 0 where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is((select total_flights from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 341,
  'nobody else can change a pilot''s totals');

select * from finish();
rollback;
