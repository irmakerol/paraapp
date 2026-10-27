-- Trips: a role for people who organise club trips, and the T1–T3 tandem ratings. Kept in
-- their own migration because a new enum value cannot be used in the transaction that adds it.
alter type public.app_role add value if not exists 'trip_organiser' before 'admin';

-- Pilot profile: tandem ratings T1–T3 (2026-10-27). Older values stay valid for existing data.
alter type public.pilot_level add value if not exists 't1' after 'p5';
alter type public.pilot_level add value if not exists 't2' after 't1';
alter type public.pilot_level add value if not exists 't3' after 't2';
