begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Users: Ayşe (adult), Bora (adult, will be a member), Cem (adult), Deniz (minor)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ayse@example.com', '{"display_name":"Ayşe","birth_date":"1990-05-01"}'),
  ('22222222-2222-2222-2222-222222222222', 'bora@example.com', '{"display_name":"Bora","birth_date":"1985-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'cem@example.com',  '{"display_name":"Cem","birth_date":"1995-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'deniz@example.com', jsonb_build_object('display_name','Deniz','birth_date', (current_date - interval '15 years')::date));

-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'member');

update public.profiles set
  full_name = 'Ayşe Yılmaz', bio = 'Thermal hunter', city = 'Fethiye', country = 'TR',
  field_privacy = field_privacy || '{"full_name":"members","bio":"public","location":"private"}'
where id = '11111111-1111-1111-1111-111111111111';

select is((select status::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'active', 'adult with birth date is active after sign-up');
select is((select status::text from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'pending_guardian', 'minor waits for guardian consent');
select ok((select every(value = 'private') from public.profiles, jsonb_each_text(field_privacy)
           where id = '44444444-4444-4444-4444-444444444444'),
  'minor profile fields default to private');

-- Act as Cem (non-member)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'a user only sees their own profiles row');
select is((select count(*)::int from public.profile_private), 1, 'a user only sees their own private row');
select is((select bio from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'),
  'Thermal hunter', 'public fields are visible to other users');
select is((select full_name from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'),
  null, 'members-only fields are hidden from non-members');
select is((select city from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'),
  null, 'private fields are hidden');
select is((select display_name from public.profile_cards where id = '44444444-4444-4444-4444-444444444444'),
  null, 'profiles waiting for guardian consent are not listed');

update public.profiles set display_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';

select lives_ok($$ update public.profiles set display_name = 'Cem K' where id = '33333333-3333-3333-3333-333333333333' $$,
  'can update own display name');
select throws_ok($$ update public.profiles set status = 'active' where id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null, 'cannot change own account status');
select throws_ok($$ update public.profiles set field_privacy = '{"bio":"everyone"}' where id = '33333333-3333-3333-3333-333333333333' $$,
  '23514', null, 'field privacy must be complete and valid');

-- Act as Bora (member)
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select full_name from public.profile_cards where id = '11111111-1111-1111-1111-111111111111'),
  'Ayşe Yılmaz', 'members see members-only fields');

-- Guests
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.profile_cards), 0, 'guests see no profiles without public-profile consent');

reset role;
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ayşe', 'another user''s update did not change the profile');
insert into public.consents (user_id, consent_type, granted, method)
values ('11111111-1111-1111-1111-111111111111', 'public_profile', true, 'signup');
set local role anon;
select is((select count(*)::int from public.profile_cards), 1, 'guests see adults who consented to a public profile');

select * from finish();
rollback;
