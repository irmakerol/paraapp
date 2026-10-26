-- In-app notifications (e.g. "your ad expires soon") are also pushed once to the user's devices.
alter table public.notifications add column pushed_at timestamptz;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;
