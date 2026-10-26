begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Start from empty tables (the demo seed adds example news and tips).
delete from public.news;
delete from public.tips;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'pilot@example.com', '{"birth_date":"1990-01-01"}'),
  ('22222222-2222-2222-2222-222222222222', 'member@example.com', '{"birth_date":"1990-01-01"}'),
  ('77777777-7777-7777-7777-777777777777', 'instructor@example.com', '{"birth_date":"1980-01-01"}'),
  ('99999999-9999-9999-9999-999999999999', 'admin@example.com', '{"birth_date":"1980-01-01"}');
insert into public.user_roles (user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'member'),
  ('77777777-7777-7777-7777-777777777777', 'instructor'),
  ('99999999-9999-9999-9999-999999999999', 'admin');
-- Onboarding finished: consents recorded.
insert into public.consents (user_id, consent_type, granted, method)
select id, 'analytics', false, 'signup' from auth.users;

insert into public.news (id, slug, title, body_md, status, published_at, members_only) values
  ('a0000000-0000-0000-0000-000000000001', 'public-news', 'Public news', 'x', 'published', now() - interval '1 hour', false),
  ('a0000000-0000-0000-0000-000000000002', 'members-news', 'Members news', 'x', 'published', now() - interval '1 hour', true),
  ('a0000000-0000-0000-0000-000000000003', 'scheduled-news', 'Scheduled', 'x', 'published', now() + interval '1 day', false),
  ('a0000000-0000-0000-0000-000000000004', 'draft-news', 'Draft', 'x', 'draft', null, false);

-- Guests
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_eq($$ select slug from public.news $$, array['public-news'],
  'guests see only published, non-members news');
reset role;

-- Pilot
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select set_eq($$ select slug from public.news $$, array['public-news'], 'pilots do not see members-only news');
select throws_ok($$ insert into public.news (slug, title) values ('x-news', 'Hacked news') $$,
  '42501', null, 'pilots cannot write news');
select lives_ok($$ insert into public.news_comments (news_id, author_id, body)
  values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Great!') $$,
  'active pilots can comment');
select throws_ok($$ insert into public.news_comments (news_id, author_id, body)
  values ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sneaky') $$,
  '42501', null, 'cannot comment on news you cannot see');
select lives_ok($$ insert into public.news_likes (news_id, user_id)
  values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$, 'can like');

-- Pilot suggests a tip
select lives_ok($$ insert into public.tips (slug, title, category, status, author_id)
  values ('my-tip', 'My launching tip', 'launching', 'pending_review', '11111111-1111-1111-1111-111111111111') $$,
  'pilots can suggest tips');
select throws_ok($$ insert into public.tips (slug, title, category, status, author_id, published_at)
  values ('self-published', 'Self published', 'launching', 'published', '11111111-1111-1111-1111-111111111111', now()) $$,
  '42501', null, 'pilots cannot publish tips themselves');
select throws_ok($$ update public.tips set status = 'published', published_at = now() where slug = 'my-tip' $$,
  '42501', null, 'pilots cannot approve their own suggestion');
reset role;

-- Member
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select set_eq($$ select slug from public.news $$, array['public-news', 'members-news'],
  'members see members-only news');
select is((select count(*)::int from public.tips), 0, 'others cannot see a pending suggestion');

-- Instructor approves
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select lives_ok($$ update public.tips set status = 'published', published_at = now(),
  reviewed_by = '77777777-7777-7777-7777-777777777777' where slug = 'my-tip' $$, 'instructors approve tips');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.tips), 1, 'published tips are visible');
select lives_ok($$ insert into public.tip_bookmarks (user_id, tip_id)
  select '22222222-2222-2222-2222-222222222222', id from public.tips where slug = 'my-tip' $$, 'can bookmark');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.tip_bookmarks), 0, 'bookmarks are private');

-- Admin sees everything
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select is((select count(*)::int from public.news), 4, 'admins see drafts and scheduled news');

select * from finish();
rollback;
