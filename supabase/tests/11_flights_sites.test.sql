begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

delete from public.sites;
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('55555555-5555-5555-5555-555555555555', 'member@example.com', '{"birth_date":"1990-01-01"}'),
  ('88888888-8888-8888-8888-888888888888', 'mod@example.com', '{"birth_date":"1985-01-01"}'),
  ('66666666-6666-6666-6666-666666666666', 'owner@example.com', '{"birth_date":"1980-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active' where id = '44444444-4444-4444-4444-444444444444';
-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values
  ('88888888-8888-8888-8888-888888888888', 'moderator'),
  ('66666666-6666-6666-6666-666666666666', 'super_admin'),
  ('55555555-5555-5555-5555-555555555555', 'member');

-- Sites ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.sites (slug, name, lat, lng) values ('x', 'X', 36, 29) $$,
  '42501', null, 'pilots cannot add sites');
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select throws_ok($$ insert into public.sites (slug, name, lat, lng) values ('y', 'Y', 36, 29) $$,
  '42501', null, 'moderators cannot add sites');
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select lives_ok($$ insert into public.sites (slug, name, kind, lat, lng, elevation_m)
  values ('babadag', 'Babadağ', 'launch', 36.5326, 29.1902, 1700) $$, 'the super admin adds sites');
reset role;
set local role anon;
select is((select count(*)::int from public.sites), 1, 'guests can read sites');
select is(public.nearest_site(36.5330, 29.1910), (select id from public.sites where slug = 'babadag'),
  'nearest site within 2 km is found');
select is(public.nearest_site(36.60, 29.30), null, 'nothing is matched far away');
reset role;

-- Flights -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.flights (user_id, started_at, duration_s, site_name, source, visibility)
  values ('11111111-1111-1111-1111-111111111111', now() - interval '1 day', 3600, 'Babadağ', 'manual', 'public') $$,
  'pilots add manual flights');
select throws_ok($$ insert into public.flights (user_id, started_at, duration_s, source)
  values ('11111111-1111-1111-1111-111111111111', now(), 60, 'igc') $$,
  '42501', null, 'pilots cannot insert "imported" flights themselves');
select throws_ok($$ insert into public.flights (user_id, started_at, duration_s, source, distance_m)
  values ('11111111-1111-1111-1111-111111111111', now(), 60, 'manual', 999999) $$,
  '42501', null, 'pilots cannot write stats directly');
select throws_ok($$ insert into public.flights (user_id, started_at, duration_s, source)
  values ('33333333-3333-3333-3333-333333333333', now(), 60, 'manual') $$,
  '42501', null, 'cannot log a flight for someone else');
reset role;

-- Imported flights are written by the server (service role / postgres here).
insert into public.flights (id, user_id, started_at, duration_s, source, visibility, distance_m, public_track) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now(), 5400, 'igc', 'members', 42000, '{"start":0,"points":[]}'),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', now(), 1200, 'igc', 'private', 5000, null),
  ('f0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', now(), 600, 'gpx', 'public', 1000, null);
insert into public.flight_tracks (flight_id, user_id, track, takeoff_lat, takeoff_lng)
  values ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '{"start":0,"points":[]}', 36.53, 29.19);

select is((select visibility::text from public.flights where id = 'f0000000-0000-0000-0000-000000000003'), 'private',
  'minors'' flights are never public');

set local role anon;
select is((select count(*)::int from public.flights), 1, 'guests see only public flights');
select is((select flights from public.pilot_stats('11111111-1111-1111-1111-111111111111')), 1,
  'stats for guests only count public flights');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.flights where user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'non-members do not see members-only flights');
select is((select count(*)::int from public.flight_tracks), 0, 'nobody else reads full tracks');
update public.flights set notes = 'mine now' where id = 'f0000000-0000-0000-0000-000000000001';
reset role;
select is((select notes from public.flights where id = 'f0000000-0000-0000-0000-000000000001'), null,
  'cannot edit someone else''s flight');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.flights where user_id = '11111111-1111-1111-1111-111111111111'), 2,
  'members see members-only flights');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.flights where user_id = '11111111-1111-1111-1111-111111111111'), 3,
  'owners see all their flights');
select is((select count(*)::int from public.flight_tracks), 1, 'owners read their full tracks');
select is((select max_distance_m from public.pilot_stats('11111111-1111-1111-1111-111111111111')), 42000,
  'owners get stats over all their flights');

-- Equipment -----------------------------------------------------------------
insert into public.equipment (id, user_id, kind, model, last_repack_on, repack_interval_months)
values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'reserve', 'Companion SQR', current_date - interval '6 months' - interval '1 day', 6);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.equipment), 0, 'equipment is private');
select throws_ok($$ insert into public.flights (user_id, started_at, duration_s, source, wing_id)
  values ('33333333-3333-3333-3333-333333333333', now(), 60, 'manual', 'e0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'cannot attach someone else''s wing');
reset role;
select private.process_equipment_reminders();
select is((select count(*)::int from public.notifications where kind = 'equipment_repack_due'), 1,
  'a repack reminder is created when due');
select private.process_equipment_reminders();
select is((select count(*)::int from public.notifications where kind = 'equipment_repack_due'), 1,
  'and only once');

-- Follows and chats with minors --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select public.start_direct_chat('44444444-4444-4444-4444-444444444444') $$,
  '42501', 'minor_protected', 'adults cannot message a minor who does not follow them');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into public.follows (follower_id, followee_id) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.start_direct_chat('44444444-4444-4444-4444-444444444444') $$,
  'adults can message a minor who follows them');

select * from finish();
rollback;
