begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('66666666-6666-6666-6666-666666666666', 'safety@example.com', '{"birth_date":"1980-01-01"}'),
  ('99999999-9999-9999-9999-999999999999', 'admin@example.com', '{"birth_date":"1980-01-01"}');
insert into public.user_roles (user_id, role) values
  ('66666666-6666-6666-6666-666666666666', 'safety_officer'),
  ('99999999-9999-9999-9999-999999999999', 'admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.incident_reports
  (reporter_id, anonymity, occurred_on, category, severity, injured, description, special_category_consent)
  values ('11111111-1111-1111-1111-111111111111', 'community_anonymous',
          current_date, 'collapse', 'minor', true, 'Asymmetric collapse near the ridge, landed hard.', true) $$,
  'pilots file a community-anonymous report under their own id');
select throws_ok($$ insert into public.incident_reports (reporter_id, anonymity, occurred_on, category, severity, description)
  values ('33333333-3333-3333-3333-333333333333', 'named', current_date, 'other', 'near_miss', 'Filed for someone else, not allowed.') $$,
  '42501', null, 'cannot file a report as someone else');
select throws_ok($$ insert into public.incident_reports (reporter_id, anonymity, occurred_on, category, severity, description)
  values (null, 'fully_anonymous', current_date, 'other', 'near_miss', 'Anonymous reports go through the server.') $$,
  '42501', null, 'fully anonymous reports cannot be inserted from a user session');
select throws_ok($$ insert into public.incident_reports (reporter_id, anonymity, occurred_on, category, severity, description, status)
  values ('11111111-1111-1111-1111-111111111111', 'named', current_date, 'other', 'near_miss', 'Trying to set the status myself.', 'closed') $$,
  '42501', null, 'reporters cannot set the status');
select lives_ok($$ select public.add_incident_injury((select id from public.incident_reports limit 1), 'v1.iv.tag.data') $$,
  'reporter adds encrypted injury details to their own report');
select throws_ok($$ select * from public.incident_injuries $$, '42501', null,
  'nobody can read the injury table directly');
select is(public.read_incident_injury((select id from public.incident_reports limit 1)), 'v1.iv.tag.data',
  'the reporter can read their own injury details');
select is((select count(*)::int from public.incident_reports), 1, 'reporters see their own report');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.incident_reports), 0, 'other pilots see no reports');
select throws_ok($$ select public.read_incident_injury((select id from public.incident_reports limit 1)) $$,
  '42501', null, 'other pilots cannot read injury details');
select throws_ok($$ select public.add_incident_injury((select id from public.incident_reports limit 1), 'v1.x.y.z') $$,
  '42501', null, 'other pilots cannot attach injury details');

select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select is((select count(*)::int from public.incident_reports), 0, 'admins do not see incident reports');
select throws_ok($$ select public.read_incident_injury((select id from public.incident_reports limit 1)) $$,
  '42501', null, 'admins cannot read injury details');

select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is((select count(*)::int from public.incident_reports), 1, 'safety officers see reports');
select is(public.read_incident_injury((select id from public.incident_reports limit 1)), 'v1.iv.tag.data',
  'safety officers can read injury details');
update public.incident_reports set status = 'closed';
reset role;
select is((select count(*)::int from public.audit_log where action in ('incident.read_injury', 'incident.status')), 2,
  'officer reads and status changes are audited');
select isnt((select closed_at from public.incident_reports ), null,
  'closing sets closed_at');

-- Retention: closed long ago → personal data removed.
update public.incident_reports set closed_at = now() - interval '400 days';
select private.purge_incident_personal_data();
select is((select reporter_id from public.incident_reports), null, 'reporter link is removed after retention');
select is((select count(*)::int from public.incident_injuries), 0, 'injury details are removed after retention');

-- Lessons
insert into public.safety_lessons (slug, title, body_md, category, severity, status)
  values ('draft-lesson', 'A draft lesson', 'x', 'collapse', 'minor', 'draft');
set local role anon;
select is((select count(*)::int from public.safety_lessons), 0, 'guests do not see draft lessons');
reset role;

select * from finish();
rollback;
