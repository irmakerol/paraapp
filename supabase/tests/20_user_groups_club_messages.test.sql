begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('71111111-1111-1111-1111-111111111111', 'owner@example.com', '{"birth_date":"1980-01-01"}'),
  ('72222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('73333333-3333-3333-3333-333333333333', 'student@example.com', '{"birth_date":"1995-01-01"}'),
  ('74444444-4444-4444-4444-444444444444', 'other@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active';
insert into public.user_roles (user_id, role) values
  ('71111111-1111-1111-1111-111111111111', 'super_admin'),
  ('72222222-2222-2222-2222-222222222222', 'admin'),
  ('73333333-3333-3333-3333-333333333333', 'student_pilot');

set local role authenticated;

-- Admins keep groups
select set_config('request.jwt.claims', '{"sub":"72222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ insert into public.user_groups (name, created_by)
  values ('Öğrenciler 2026', '72222222-2222-2222-2222-222222222222') $$,
  'admins create groups');
select lives_ok($$ insert into public.user_group_members (group_id, user_id, added_by)
  select id, '73333333-3333-3333-3333-333333333333', '72222222-2222-2222-2222-222222222222'
  from public.user_groups where name = 'Öğrenciler 2026' $$,
  'admins add people to groups');
select throws_ok($$ select public.send_club_message('all', null, null, 'Merhaba', 'Selam') $$,
  '42501', null, 'admins cannot send club messages');

-- Others cannot
select set_config('request.jwt.claims', '{"sub":"74444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.user_groups), 0, 'others do not see groups they are not in');
select throws_ok($$ insert into public.user_group_members (group_id, user_id, added_by)
  values ((select id from public.user_groups limit 1), '74444444-4444-4444-4444-444444444444', '74444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'or add themselves');
select throws_ok($$ select public.send_club_message('all', null, null, 'Spam', 'Spam') $$,
  '42501', null, 'or send club messages');

-- Members see their own groups
select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.user_groups), 1, 'members see groups they are in');

-- The super admin sends
select set_config('request.jwt.claims', '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.send_club_message('group', null,
  (select id from public.user_groups where name = 'Öğrenciler 2026'), 'Ders saati değişti', 'Cumartesi 10:00') $$, 'the super admin sends to a group');
select is((select recipient_count from public.club_messages where title = 'Ders saati değişti'), 1,
  'only the group receives it');
select lives_ok($$ select public.send_club_message('role', 'student_pilot', null, 'Öğrencilere', 'Yer çalışması') $$,
  'and to a role');
select lives_ok($$ select public.send_club_message('all', null, null, 'Herkese', 'Sezon açıldı') $$,
  'and to everyone');
select is((select recipient_count from public.club_messages where title = 'Herkese'), 4, 'everyone active receives it');

select set_config('request.jwt.claims', '{"sub":"74444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select set_eq($$ select title from public.club_messages $$, array['Herkese'],
  'people see only the messages they received');
update public.club_message_recipients set read_at = now();
reset role;
select is((select count(*)::int from public.club_message_recipients where read_at is not null), 1,
  'and can mark only their own as read');

select * from finish();
rollback;
