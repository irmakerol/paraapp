begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('55555555-5555-5555-5555-555555555555', 'member@example.com', '{"birth_date":"1990-01-01"}'),
  ('77777777-7777-7777-7777-777777777777', 'instructor@example.com', '{"birth_date":"1980-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active' where id = '44444444-4444-4444-4444-444444444444';
-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values
  ('77777777-7777-7777-7777-777777777777', 'instructor'),
  ('55555555-5555-5555-5555-555555555555', 'member');

-- Events --------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.events (slug, title, starts_at, ends_at)
  values ('x', 'Not mine', now(), now()) $$, '42501', null, 'pilots cannot create events');
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select lives_ok($$ insert into public.events (id, slug, title, starts_at, ends_at, status, capacity) values
  ('e0000000-0000-0000-0000-000000000001', 'trip', 'Club trip', now() + interval '7 days', now() + interval '8 days', 'published', 1),
  ('e0000000-0000-0000-0000-000000000002', 'members', 'Members meeting', now() + interval '7 days', now() + interval '7 days', 'published', null),
  ('e0000000-0000-0000-0000-000000000003', 'draft', 'Draft event', now() + interval '7 days', now() + interval '7 days', 'draft', null),
  ('e0000000-0000-0000-0000-000000000004', 'open', 'Open day', now() + interval '7 days', now() + interval '7 days', 'published', null) $$,
  'instructors create events');
update public.events set members_only = true where id = 'e0000000-0000-0000-0000-000000000002';
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.events), 2, 'guests see only public published events');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.events), 3, 'members also see members-only events');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.event_rsvps (event_id, user_id, status)
  values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'going') $$, 'pilots sign up');
select throws_ok($$ insert into public.event_rsvps (event_id, user_id, status)
  values ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'going') $$,
  '42501', null, 'non-members cannot sign up for members-only events');
select throws_ok($$ insert into public.event_rsvps (event_id, user_id, status)
  values ('e0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'going') $$,
  '42501', null, 'cannot sign someone else up');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ insert into public.event_rsvps (event_id, user_id, status)
  values ('e0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'going') $$,
  '22023', 'event_full', 'capacity is enforced');
select is((select count(*)::int from public.event_rsvps), 0, 'pilots cannot see other people''s sign-ups');
select is((select going::int from public.event_counts('e0000000-0000-0000-0000-000000000001')), 1, 'counts are public');

-- Rides ---------------------------------------------------------------------
select lives_ok($$ insert into public.rides (user_id, kind, ride_date, from_text, seats)
  values ('33333333-3333-3333-3333-333333333333', 'offer', current_date + 1, 'Kadıköy', 3) $$, 'adults post rides');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.rides), 0, 'minors do not see the ride board');
select throws_ok($$ insert into public.rides (user_id, kind, ride_date, from_text)
  values ('44444444-4444-4444-4444-444444444444', 'request', current_date + 1, 'Kartal') $$,
  '42501', null, 'minors cannot post rides');

-- Group chats ---------------------------------------------------------------
select throws_ok($$ select public.create_group_chat('Teens', array['11111111-1111-1111-1111-111111111111'::uuid]) $$,
  '42501', null, 'minors cannot create group chats');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select public.create_group_chat('Mixed', array['44444444-4444-4444-4444-444444444444'::uuid]) $$,
  '42501', 'member_not_allowed', 'minors cannot be added to group chats');
select lives_ok($$ select public.create_group_chat('Babadağ crew', array['33333333-3333-3333-3333-333333333333'::uuid]) $$,
  'adults create group chats');
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.chats where kind = 'group'), 0, 'non-members cannot see the group');
reset role;

-- Weather cache is server-written only.
set local role authenticated;
select throws_ok($$ insert into public.weather_forecasts (site_id, data) values (gen_random_uuid(), '{}') $$,
  '42501', null, 'users cannot write the weather cache');
reset role;

select * from finish();
rollback;
