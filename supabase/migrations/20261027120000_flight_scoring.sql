-- Phase 6: cross-country score (XContest-style estimate) on each flight.
-- Worked out by the server from the full track and written with the service role, like the
-- other flight statistics. Only the numbers are stored: the turnpoints of a free-distance
-- flight include takeoff and landing, which other people must not see.

alter table public.flights
  add column xc_type text check (xc_type in ('free', 'flat', 'fai')),
  add column xc_distance_m integer check (xc_distance_m >= 0),
  add column xc_points numeric(7, 2) check (xc_points >= 0);

-- Columns are not in the users' update grant, so only the server can set them.
create index flights_xc_points_idx on public.flights (xc_points desc nulls last)
  where visibility = 'public';
