begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select throws_ok($$ insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'kid@example.com',
   jsonb_build_object('birth_date', (current_date - interval '13 years')::date)) $$,
  '22023', 'too_young', 'sign-up under 14 is rejected by the database');

-- Google-style sign-up without a birth date goes to onboarding
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'teen@example.com', '{"name":"Ece"}');
select is((select status::text from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'onboarding', 'sign-up without birth date starts in onboarding');

-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is(public.complete_age_gate((current_date - interval '16 years')::date)::text, 'pending_guardian',
  '16-year-old needs guardian consent');
select throws_ok($$ select public.complete_age_gate('1990-01-01') $$, '22023', 'age_gate_already_completed',
  'birth date cannot be changed afterwards');
select throws_ok($$ select public.create_guardian_request('66666666-6666-6666-6666-666666666666', 'Parent', 'p@example.com') $$,
  '42501', null, 'the minor cannot create (and so cannot see) a guardian token');

-- Server (service role) creates the request and e-mails the token
reset role;
set local role service_role;
create temp table t_token as
  select public.create_guardian_request('66666666-6666-6666-6666-666666666666', 'Parent Name', 'Parent@Example.com') as token;
grant select on t_token to anon;
reset role;

select is((select guardian_email from public.guardian_consents), 'parent@example.com', 'guardian email stored normalised');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select display_name from public.guardian_request_info((select token from t_token))), 'Ece',
  'guardian sees whose account they are confirming');
select is(public.confirm_guardian_consent('wrong-token'), false, 'a wrong token does nothing');
select is(public.confirm_guardian_consent((select token from t_token)), true, 'guardian confirms with the token');
select is(public.confirm_guardian_consent((select token from t_token)), false, 'a token works only once');

reset role;
select is((select status::text from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'active', 'minor becomes active after guardian consent');

select * from finish();
rollback;
