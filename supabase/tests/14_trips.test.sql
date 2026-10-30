begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('55555555-5555-5555-5555-555555555555', 'member@example.com', '{"birth_date":"1990-01-01"}'),
  ('66666666-6666-6666-6666-666666666666', 'guide@example.com', '{"birth_date":"1985-01-01"}'),
  ('77777777-7777-7777-7777-777777777777', 'organiser@example.com', '{"birth_date":"1980-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active';
update public.profiles set pilot_level = 'p3', years_flying = 4
  where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
               '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444');
update public.profiles set pilot_level = 'p1', years_flying = 0 where id = '55555555-5555-5555-5555-555555555555';
-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values
  ('77777777-7777-7777-7777-777777777777', 'trip_organiser'),
  ('55555555-5555-5555-5555-555555555555', 'member');

-- Only organisers create trips ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.trips (slug, title, starts_on, ends_on, max_pilots)
  values ('x', 'Not mine', current_date + 30, current_date + 32, 5) $$, '42501', null, 'pilots cannot create trips');
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select lives_ok($$ insert into public.trips (id, slug, title, starts_on, ends_on, max_pilots, status, min_pilot_level, created_by) values
  ('f0000000-0000-0000-0000-000000000001', 'olu', 'Ölüdeniz', current_date + 30, current_date + 33, 2, 'open', 'p2', '77777777-7777-7777-7777-777777777777'),
  ('f0000000-0000-0000-0000-000000000002', 'members', 'Members trip', current_date + 30, current_date + 33, 5, 'open', null, null),
  ('f0000000-0000-0000-0000-000000000003', 'draft', 'Draft trip', current_date + 30, current_date + 33, 5, 'draft', null, null) $$,
  'trip organisers create trips');
update public.trips set members_only = true where id = 'f0000000-0000-0000-0000-000000000002';
select lives_ok($$ insert into public.trip_guides (trip_id, user_id, role_label)
  values ('f0000000-0000-0000-0000-000000000003', '66666666-6666-6666-6666-666666666666', 'Lead guide') $$,
  'organisers assign guides');
reset role;

-- Visibility ----------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.trips where id::text like 'f0000000-%'), 1, 'guests see only public, non-draft trips');
select is((select count(*)::int from public.trip_guides), 0, 'guides of draft trips are hidden from guests');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.trips where id::text like 'f0000000-%'), 2, 'members also see members-only trips');
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is((select count(*)::int from public.trips where status = 'draft'), 1, 'guides see the draft of their trip');
update public.trips set title = 'Hijack' where id = 'f0000000-0000-0000-0000-000000000003';
select is((select title from public.trips where id = 'f0000000-0000-0000-0000-000000000003'), 'Draft trip', 'guides cannot edit trips');

-- Interest ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.trip_interests (trip_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$, 'pilots show interest');
select throws_ok($$ insert into public.trip_interests (trip_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'cannot add interest for someone else');
select throws_ok($$ insert into public.trip_interests (trip_id, user_id)
  values ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'non-members cannot show interest in members-only trips');

-- Registration --------------------------------------------------------------
select throws_ok($$ insert into public.trip_registrations (trip_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'pilots cannot write registrations directly');
select is(public.register_for_trip('f0000000-0000-0000-0000-000000000001', 0::smallint, 'Hi', '+90 555', 'Mum', '+90 556'),
  'pending'::public.trip_registration_status, 'registering gives a pending seat');
select is((select count(*)::int from public.trip_interests), 0, 'registering replaces interest');
select throws_ok($$ select public.register_for_trip('f0000000-0000-0000-0000-000000000001') $$,
  '22023', 'already_registered', 'cannot register twice');
update public.trip_registrations set status = 'accepted' where user_id = auth.uid();
select is((select status::text from public.trip_registrations where user_id = auth.uid()), 'pending', 'pilots cannot accept themselves');

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok($$ select public.register_for_trip('f0000000-0000-0000-0000-000000000001') $$,
  '22023', 'requirements_not_met', 'the minimum pilot level is enforced');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ select public.register_for_trip('f0000000-0000-0000-0000-000000000001') $$,
  '42501', 'adults_only', 'minors cannot register unless the trip allows it');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.register_for_trip('f0000000-0000-0000-0000-000000000001'),
  'pending'::public.trip_registration_status, 'second pilot takes the last seat');
select is((select count(*)::int from public.trip_registrations), 1, 'pilots only see their own registration');
select is((select seats_taken from public.trip_counts('f0000000-0000-0000-0000-000000000001')), 2, 'counts are public');
reset role;

-- A third pilot goes on the waiting list.
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-8888-8888-888888888888', 'third@example.com', '{"birth_date":"1990-01-01"}');
update public.profiles set status = 'active', pilot_level = 'p4' where id = '88888888-8888-8888-8888-888888888888';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select is(public.register_for_trip('f0000000-0000-0000-0000-000000000001'),
  'waitlisted'::public.trip_registration_status, 'a full trip puts new pilots on the waiting list');

-- Staff decide ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is((select count(*)::int from public.trip_registrations), 0, 'guides of other trips see no registrations');
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is((select count(*)::int from public.trip_registrations), 3, 'organisers see all registrations');
select lives_ok($$ update public.trip_registrations set status = 'accepted', payment_status = 'deposit_paid'
  where user_id = '11111111-1111-1111-1111-111111111111' $$, 'organisers accept and record payment');
select throws_ok($$ update public.trip_registrations set status = 'accepted'
  where user_id = '88888888-8888-8888-8888-888888888888' $$, '22023', 'trip_full', 'cannot accept beyond capacity');
select throws_ok($$ update public.trip_registrations set phone = 'x'
  where user_id = '11111111-1111-1111-1111-111111111111' $$, '42501', null, 'staff cannot change pilots'' contact details');
reset role;

-- Cancelling frees the seat and moves the waiting list up.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ select public.cancel_trip_registration('f0000000-0000-0000-0000-000000000001') $$, 'pilots cancel');
reset role;
select is((select status::text from public.trip_registrations where user_id = '88888888-8888-8888-8888-888888888888'),
  'pending', 'the first waitlisted pilot moves up');
select ok((select count(*) from public.notifications
           where user_id = '88888888-8888-8888-8888-888888888888' and kind = 'trip_registration') > 0,
  'the promoted pilot is notified');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select public.notify_trip_followers('f0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'pilots cannot message trip followers');
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select lives_ok($$ update public.trips set status = 'cancelled' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'organisers cancel a trip');
reset role;
select is((select count(*)::int from public.notifications where kind = 'trip_cancelled'), 2,
  'everyone still registered hears about the cancellation');

select * from finish();
rollback;
