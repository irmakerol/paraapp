begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('d2222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('d3333333-3333-3333-3333-333333333333', 'pilot@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active';
insert into public.user_roles (user_id, role) values
  ('d2222222-2222-2222-2222-222222222222', 'admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ update public.profiles set is_instructor = true, bio = 'hi' where id = 'd3333333-3333-3333-3333-333333333333' $$,
  'a profile save that includes the flag still works');
select is((select is_instructor from public.profiles where id = 'd3333333-3333-3333-3333-333333333333'), false,
  'but members cannot make themselves instructors');

select set_config('request.jwt.claims', '{"sub":"d2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.admin_set_instructor('d3333333-3333-3333-3333-333333333333', true);
reset role;
select is((select is_instructor from public.profiles where id = 'd3333333-3333-3333-3333-333333333333'), true,
  'admins set it');

select * from finish();
rollback;
