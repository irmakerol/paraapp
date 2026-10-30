begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('51111111-1111-1111-1111-111111111111', 'owner@example.com', '{"birth_date":"1980-01-01"}'),
  ('52222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('53333333-3333-3333-3333-333333333333', 'pilot@example.com', '{"birth_date":"1990-01-01"}');
insert into public.user_roles (user_id, role) values
  ('51111111-1111-1111-1111-111111111111', 'super_admin'),
  ('52222222-2222-2222-2222-222222222222', 'admin');

select is((select count(*)::int from public.user_roles
           where user_id = '51111111-1111-1111-1111-111111111111' and role = 'admin'),
  1, 'a super admin is also an admin');

set local role authenticated;

-- A plain admin manages ordinary roles but not admins.
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('53333333-3333-3333-3333-333333333333', 'guide', '52222222-2222-2222-2222-222222222222') $$,
  'an admin can grant the guide role');
select ok(private.is_member_level('53333333-3333-3333-3333-333333333333'), 'guides count as members');
select throws_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('53333333-3333-3333-3333-333333333333', 'admin', '52222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'an admin cannot make another admin');
select throws_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('52222222-2222-2222-2222-222222222222', 'super_admin', '52222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'or make themselves super admin');
delete from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111'
           and role in ('admin', 'super_admin')),
  2, 'or remove the super admin');

-- The super admin manages admins.
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('53333333-3333-3333-3333-333333333333', 'admin', '51111111-1111-1111-1111-111111111111') $$,
  'the super admin can make an admin');
delete from public.user_roles where user_id = '52222222-2222-2222-2222-222222222222' and role = 'admin';
select is((select count(*)::int from public.user_roles where user_id = '52222222-2222-2222-2222-222222222222' and role = 'admin'),
  0, 'and remove one');
delete from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111'
           and role in ('admin', 'super_admin')),
  2, 'but not their own admin or super admin role');

-- A pilot can do none of it.
select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('53333333-3333-3333-3333-333333333333', 'super_admin', '53333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'the new admin still cannot make themselves super admin');
reset role;

-- Losing admin also removes super admin (e.g. when the owner hands over the club).
delete from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111' and role = 'admin';
select is((select count(*)::int from public.user_roles where user_id = '51111111-1111-1111-1111-111111111111'
           and role in ('admin', 'super_admin')),
  0, 'removing admin also removes super admin');

select * from finish();
rollback;
