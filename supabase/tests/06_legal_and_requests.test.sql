begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ayse@example.com', '{"birth_date":"1990-05-01"}'),
  ('33333333-3333-3333-3333-333333333333', 'cem@example.com', '{"birth_date":"1995-01-01"}');

-- Start from a known state regardless of seed data.
delete from public.consents;
delete from public.legal_documents;
insert into public.legal_documents (id, kind, locale, version, title, body_md, published_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'privacy_notice', 'tr', 1, 'Aydınlatma Metni', '...', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'terms', 'tr', 1, 'Kullanım Koşulları', '...', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'terms', 'tr', 2, 'Kullanım Koşulları', 'draft', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select set_eq($$ select k::text from public.pending_legal_kinds() k $$, array['privacy_notice', 'terms'],
  'new users must see the privacy notice and accept the terms');
insert into public.legal_acceptances (user_id, document_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002');
select is_empty($$ select * from public.pending_legal_kinds() $$, 'nothing pending after accepting');
select is((select count(*)::int from public.legal_documents), 2, 'unpublished drafts are not visible');

reset role;
update public.legal_documents set published_at = now() where version = 2;
set local role authenticated;
select set_eq($$ select k::text from public.pending_legal_kinds() k $$, array['terms'],
  'a material new version re-prompts');

-- Data-subject requests
insert into public.data_requests (user_id, requester_email, request_type, channel)
values ('11111111-1111-1111-1111-111111111111', 'ayse@example.com', 'access', 'in_app');
select ok((select due_at <= received_at + interval '30 days' from public.data_requests),
  'due date is set within 30 days');
select throws_ok($$ insert into public.data_requests (user_id, requester_email, request_type, channel)
  values ('33333333-3333-3333-3333-333333333333', 'cem@example.com', 'access', 'in_app') $$,
  '42501', null, 'cannot file a request for someone else');
update public.data_requests set status = 'completed';
reset role;
select is((select status::text from public.data_requests), 'received',
  'users cannot mark their own request completed');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.data_requests), 0, 'users cannot see other users'' requests');

select * from finish();
rollback;
