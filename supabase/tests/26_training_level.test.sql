begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('c2222222-2222-2222-2222-222222222222', 'admin@example.com', '{"birth_date":"1980-01-01"}'),
  ('c3333333-3333-3333-3333-333333333333', 'student@example.com', '{"birth_date":"1990-01-01"}'),
  ('c4444444-4444-4444-4444-444444444444', 'other@example.com', '{"birth_date":"1991-01-01"}');
update public.profiles set status = 'active';
update public.profiles set pilot_level = 'p3' where id = 'c3333333-3333-3333-3333-333333333333';
insert into public.user_roles (user_id, role) values
  ('c2222222-2222-2222-2222-222222222222', 'admin'),
  ('c3333333-3333-3333-3333-333333333333', 'student_pilot');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ update public.profiles set training_level = 'p4' where id = 'c3333333-3333-3333-3333-333333333333' $$,
  'a P3 student pilot can train for P4');
select throws_ok($$ update public.profiles set training_level = 'p3' where id = 'c3333333-3333-3333-3333-333333333333' $$,
  '23514', null, 'but not for their own level');
select throws_ok($$ update public.profiles set training_level = 'p2' where id = 'c3333333-3333-3333-3333-333333333333' $$,
  '23514', null, 'or a lower one');
update public.profiles set pilot_level = 'p4' where id = 'c3333333-3333-3333-3333-333333333333';
select is((select training_level::text from public.profiles where id = 'c3333333-3333-3333-3333-333333333333'), null,
  'reaching the target clears it');
update public.profiles set training_level = 't1' where id = 'c4444444-4444-4444-4444-444444444444';
select is((select training_level::text from public.profiles where id = 'c4444444-4444-4444-4444-444444444444'), null,
  'nobody can set it for someone else');
select throws_ok($$ select public.admin_set_training_level('c4444444-4444-4444-4444-444444444444', 'p3') $$,
  '42501', null, 'members cannot use the admin function');

select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_training_level('c3333333-3333-3333-3333-333333333333', 'p5') $$,
  'admins set it for a member');
reset role;
select is((select training_level::text from public.profiles where id = 'c3333333-3333-3333-3333-333333333333'), 'p5',
  'the target is saved');

-- Others see it on the profile card only when the pilot level is visible to them.
update public.profiles set field_privacy = field_privacy || '{"pilot_level":"members"}'
  where id = 'c3333333-3333-3333-3333-333333333333';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select training_level::text from public.profile_cards where id = 'c3333333-3333-3333-3333-333333333333'), 'p5',
  'members see the training level when the pilot level is shown to members');
reset role;
update public.profiles set field_privacy = field_privacy || '{"pilot_level":"private"}'
  where id = 'c3333333-3333-3333-3333-333333333333';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select training_level::text from public.profile_cards where id = 'c3333333-3333-3333-3333-333333333333'), null,
  'and not when the pilot level is private');
reset role;

select * from finish();
rollback;
