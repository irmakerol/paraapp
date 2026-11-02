-- Which body issued the pilot's licence (Irmak, 2026-10-30). Owner-only like the licence number;
-- not sensitive on its own, so stored as plain text.
alter table public.profile_private
  add column licence_body text check (licence_body in ('ushpa', 'appi', 'thk', 'bhpa', 'ffvl', 'dhv', 'other'));
grant update (licence_body) on public.profile_private to authenticated;
