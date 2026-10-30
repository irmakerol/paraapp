begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('61111111-1111-1111-1111-111111111111', 'owner@example.com', '{"birth_date":"1980-01-01"}'),
  ('62222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('63333333-3333-3333-3333-333333333333', 'pilot@example.com', '{"birth_date":"1990-01-01"}');
insert into public.user_roles (user_id, role) values
  ('61111111-1111-1111-1111-111111111111', 'super_admin'),
  ('62222222-2222-2222-2222-222222222222', 'admin');
update public.profiles set display_name = 'Ayse Demr', avatar_path = '63333333-3333-3333-3333-333333333333/a.webp'
where id = '63333333-3333-3333-3333-333333333333';

set local role authenticated;

-- A pilot cannot use it, even on their own profile.
select set_config('request.jwt.claims', '{"sub":"63333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.admin_update_profile('63333333-3333-3333-3333-333333333333',
  'Ayşe Demir', null, null, null, null, null) $$, '42501', null, 'members cannot use the admin edit');

-- An admin fixes a name and removes the photo.
select set_config('request.jwt.claims', '{"sub":"62222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.admin_update_profile('63333333-3333-3333-3333-333333333333',
  'Ayşe Demir', null, 'İstanbul', null, 'p3', null, true),
  '63333333-3333-3333-3333-333333333333/a.webp', 'an admin can edit and gets the removed photo path back');
select is((select display_name from public.profiles where id = '63333333-3333-3333-3333-333333333333'),
  'Ayşe Demir', 'the name is fixed');
select is((select avatar_path from public.profiles where id = '63333333-3333-3333-3333-333333333333'),
  null, 'the photo is removed');
select is((select details -> 'fields' from public.audit_log where action = 'profile.admin_edit'),
  '["display_name", "city", "pilot_level", "photo"]'::jsonb, 'the change is audited');
select throws_ok($$ select public.admin_update_profile('61111111-1111-1111-1111-111111111111',
  'Hacked', null, null, null, null, null) $$, '42501', null, 'an admin cannot edit the super admin');
select throws_ok($$ select public.admin_update_profile('63333333-3333-3333-3333-333333333333',
  'x', null, null, null, null, null) $$, '23514', null, 'the usual field checks apply');

-- The super admin can edit another admin.
select set_config('request.jwt.claims', '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.admin_update_profile('62222222-2222-2222-2222-222222222222',
  'Club Admin', null, null, null, null, null) $$, 'the super admin can edit an admin');
reset role;

select * from finish();
rollback;
