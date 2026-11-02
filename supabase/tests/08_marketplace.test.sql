begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'seller@example.com', '{"birth_date":"1990-01-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('88888888-8888-8888-8888-888888888888', 'mod@example.com', '{"birth_date":"1985-01-01"}'),
  ('44444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active' where id = '44444444-4444-4444-4444-444444444444';
-- New accounts are guest members by default; these tests start from accounts without roles.
delete from public.user_roles where role = 'member';
insert into public.user_roles (user_id, role) values ('88888888-8888-8888-8888-888888888888', 'moderator');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.ads (id, owner_id, title, category, condition, price)
  values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ozone Rush 6 ML', 'wing', 'good', 1800) $$,
  'adults can post ads');
select throws_ok($$ insert into public.ads (owner_id, title, category, condition, price, is_club)
  values ('11111111-1111-1111-1111-111111111111', 'Fake club ad', 'wing', 'good', 1, true) $$,
  '42501', null, 'only admins can post as the club');
select throws_ok($$ update public.ads set expires_at = now() + interval '10 years' $$,
  '42501', null, 'owners cannot set the expiry directly');
select ok(public.renew_ad('b0000000-0000-0000-0000-000000000001') > now() + interval '59 days', 'owners can renew');
select lives_ok($$ insert into public.ad_photos (ad_id, path, position)
  values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111/a.webp', 0) $$, 'owners add photos');

-- Minor
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ insert into public.ads (owner_id, title, category, condition, price)
  values ('44444444-4444-4444-4444-444444444444', 'Teen ad', 'helmet', 'good', 10) $$,
  '42501', null, 'minors cannot post ads');

-- Someone else
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.ads), 1, 'active ads are visible to others');
select is((select count(*)::int from public.ad_photos), 1, 'photos of visible ads are visible');
update public.ads set price = 1 where id = 'b0000000-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.ad_photos (ad_id, path, position)
  values ('b0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333/x.webp', 1) $$,
  '42501', null, 'others cannot add photos to my ad');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('33333333-3333-3333-3333-333333333333', 'ad', 'b0000000-0000-0000-0000-000000000001', 'scam') $$,
  'anyone signed in can report an ad');

-- Moderator removes it
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select is((select count(*)::int from public.reports where status = 'open'), 1, 'moderators see the report');
update public.ads set removed_at = now(), removed_by = '88888888-8888-8888-8888-888888888888'
where id = 'b0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.ads), 0, 'removed ads disappear');

reset role;
select is((select price from public.ads), 1800::numeric(12,2), 'others could not change the price');

-- Expiry job
update public.ads set removed_at = null, expires_at = now() - interval '1 minute';
select private.process_ad_expiry();
select is((select status::text from public.ads), 'archived', 'expired ads are archived');

select * from finish();
rollback;
