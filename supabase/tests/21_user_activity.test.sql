begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('81111111-1111-1111-1111-111111111111', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('82222222-2222-2222-2222-222222222222', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('83333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active';
insert into public.user_roles (user_id, role) values ('81111111-1111-1111-1111-111111111111', 'admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.touch_last_seen() $$, 'a signed-in person marks themselves online');
select public.touch_last_seen();
select is((select count(*)::int from public.user_activity where kind = 'visit'), 1,
  'repeated page views within minutes count as one visit');
select throws_ok($$ update public.profiles set last_seen_at = now() - interval '1 year'
  where id = '82222222-2222-2222-2222-222222222222' $$, '42501', null, 'last seen cannot be faked');
select throws_ok($$ insert into public.user_activity (user_id, kind)
  values ('82222222-2222-2222-2222-222222222222', 'fake') $$, '42501', null, 'nobody writes the log directly');
select lives_ok($$ insert into public.flights (user_id, started_at, duration_s, source)
  values ('82222222-2222-2222-2222-222222222222', now(), 600, 'manual') $$, 'adding a flight');
select is((select count(*)::int from public.user_activity where kind = 'flight.added'), 1, 'is logged');

select set_config('request.jwt.claims', '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.user_activity), 0, 'others cannot read the log');

select set_config('request.jwt.claims', '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.user_activity where user_id = '82222222-2222-2222-2222-222222222222'), 2,
  'admins read it');
reset role;

select * from finish();
rollback;
