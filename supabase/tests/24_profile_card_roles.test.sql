begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b1111111-1111-1111-1111-111111111111', 'chief@example.com', '{"birth_date":"1980-01-01"}'),
  ('b2222222-2222-2222-2222-222222222222', 'viewer@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active', age_group = 'adult';
insert into public.user_roles (user_id, role) values
  ('b1111111-1111-1111-1111-111111111111', 'pilot'),
  ('b1111111-1111-1111-1111-111111111111', 'instructor'),
  ('b1111111-1111-1111-1111-111111111111', 'super_admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select roles from public.profile_cards where id = 'b1111111-1111-1111-1111-111111111111'),
  array['super_admin', 'admin', 'instructor', 'pilot', 'member'],
  'other members see every role, most notable first');
select is((select roles from public.profile_cards where id = 'b2222222-2222-2222-2222-222222222222'),
  array['member'], 'a new account is a guest member');
select lives_ok($$ update public.profiles set is_instructor = true, pilot_level = 'p5'
  where id = 'b2222222-2222-2222-2222-222222222222' $$, 'a pilot can be P5 and tick instructor');
select is((select roles from public.profile_cards where id = 'b2222222-2222-2222-2222-222222222222'),
  array['member'], 'ticking the box grants no role');
reset role;

select * from finish();
rollback;
