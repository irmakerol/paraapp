begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b2222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('b3333333-3333-3333-3333-333333333333', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('b4444444-4444-4444-4444-444444444444', 'admin2@example.com', '{"birth_date":"1985-01-01"}');
update public.profiles set status = 'active';
insert into public.user_roles (user_id, role) values
  ('b2222222-2222-2222-2222-222222222222', 'admin'),
  ('b4444444-4444-4444-4444-444444444444', 'admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.admin_set_instructor('b4444444-4444-4444-4444-444444444444', true) $$,
  '42501', null, 'members cannot set the instructor box for others');

select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_instructor('b3333333-3333-3333-3333-333333333333', true) $$,
  'admins tick the instructor box for a member');
select throws_ok($$ select public.admin_set_instructor('b4444444-4444-4444-4444-444444444444', true) $$,
  '42501', null, 'but not for another admin');
reset role;
select ok((select is_instructor from public.profiles where id = 'b3333333-3333-3333-3333-333333333333'),
  'the box is saved');

select * from finish();
rollback;
