-- "I'm flying right now": the phone tracker keeps one row per pilot while it records, so the
-- website can show the Fly button as "Flying". No position is stored here (live tracking is a
-- later, opt-in feature). Owner-only; rows go when recording stops or the account is deleted.
create table public.active_flights (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.active_flights enable row level security;

revoke all on public.active_flights from anon, authenticated;
grant select, insert, delete on public.active_flights to authenticated;
grant update (started_at, updated_at) on public.active_flights to authenticated;

create policy "active flights: own row" on public.active_flights
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
