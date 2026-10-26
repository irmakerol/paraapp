begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ayse@example.com', '{"birth_date":"1990-05-01"}'),
  ('99999999-9999-9999-9999-999999999999', 'admin@example.com', '{"birth_date":"1980-01-01"}');
insert into public.user_roles (user_id, role) values ('99999999-9999-9999-9999-999999999999', 'admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Consents
select lives_ok($$ insert into public.consents (user_id, consent_type, granted, method)
  values ('11111111-1111-1111-1111-111111111111', 'analytics', true, 'signup') $$, 'can record own consent');
select lives_ok($$ insert into public.consents (user_id, consent_type, granted, method)
  values ('11111111-1111-1111-1111-111111111111', 'analytics', false, 'settings') $$, 'can withdraw own consent');
select is((select granted from public.current_consents where consent_type = 'analytics'), false,
  'latest consent record wins');
select throws_ok($$ insert into public.consents (user_id, consent_type, granted, method)
  values ('99999999-9999-9999-9999-999999999999', 'analytics', true, 'signup') $$,
  '42501', null, 'cannot record consent for someone else');
select throws_ok($$ delete from public.consents $$, '42501', null, 'consent history cannot be deleted');

-- Roles
select throws_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('11111111-1111-1111-1111-111111111111', 'admin', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'a pilot cannot make themselves admin');
select is((select count(*)::int from public.audit_log), 0, 'non-admins cannot read the audit log');
select throws_ok($$ insert into public.audit_log (action) values ('fake') $$, '42501', null,
  'nobody can write the audit log directly');

-- Admin
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select lives_ok($$ insert into public.user_roles (user_id, role, granted_by)
  values ('11111111-1111-1111-1111-111111111111', 'member', '99999999-9999-9999-9999-999999999999') $$,
  'an admin can grant the member role');
select is((select action from public.audit_log where target_id = '11111111-1111-1111-1111-111111111111'
           and details ->> 'role' = 'member'),
  'role.grant', 'role grants are audited with the acting admin');
select is((select actor_id from public.audit_log where details ->> 'role' = 'member'),
  '99999999-9999-9999-9999-999999999999'::uuid, 'audit records who acted');

select * from finish();
rollback;
