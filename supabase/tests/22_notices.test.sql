begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('91111111-1111-1111-1111-111111111111', 'poster@example.com', '{"birth_date":"1990-01-01"}'),
  ('92222222-2222-2222-2222-222222222222', 'other@example.com', '{"birth_date":"1990-01-01"}'),
  ('94444444-4444-4444-4444-444444444444', 'teen@example.com', jsonb_build_object('birth_date', (current_date - interval '16 years')::date));
update public.profiles set status = 'active';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.notices (user_id, kind, category, title, price, currency)
  values ('91111111-1111-1111-1111-111111111111',
    'offer', 'gear', 'Spare harness', 100, 'EUR') $$, 'adults post notices');
select ok((select expires_at between now() + interval '29 days' and now() + interval '31 days'
  from public.notices where category = 'gear'), 'a notice closes itself after 30 days');
select throws_ok($$ insert into public.notices (user_id, kind, category, title)
  values ('92222222-2222-2222-2222-222222222222', 'offer', 'other', 'In your name') $$,
  '42501', null, 'nobody posts in someone else''s name');
select throws_ok($$ insert into public.notices (user_id, kind, category, title, expires_at)
  values ('91111111-1111-1111-1111-111111111111', 'offer', 'other', 'Forever', now() + interval '5 years') $$,
  '42501', null, 'the expiry cannot be chosen on insert');
select throws_ok($$ update public.notices set expires_at = now() + interval '1 year'
  where category = 'gear' $$, '42501', null, 'renewal is capped at 30 days');
select lives_ok($$ update public.notices set expires_at = now() + interval '30 days', closed = true
  where category = 'gear' $$, 'owners renew and close their notice');
select throws_ok($$ insert into public.notices (user_id, kind, category, title, photo_path)
  values ('91111111-1111-1111-1111-111111111111', 'offer', 'other', 'Their photo',
    '92222222-2222-2222-2222-222222222222/x.webp') $$, '42501', null, 'photos must be in your own folder');

select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.notices), 1, 'other adults read the board');
update public.notices set title = 'Hijacked' where category = 'gear';
delete from public.notices where category = 'gear';
select set_config('request.jwt.claims', '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select title from public.notices where category = 'gear'), 'Spare harness',
  'others cannot edit or delete a notice');

select set_config('request.jwt.claims', '{"sub":"94444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.notices), 0, 'minors do not see the board');
select throws_ok($$ insert into public.notices (user_id, kind, category, title)
  values ('94444444-4444-4444-4444-444444444444', 'request', 'gear', 'Looking for a wing') $$,
  '42501', null, 'minors cannot post');

set local role anon;
select is((select count(*)::int from public.notices), 0, 'signed-out visitors see nothing');
reset role;

select * from finish();
rollback;
