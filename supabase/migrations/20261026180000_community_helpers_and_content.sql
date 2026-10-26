-- Phase 1: shared helpers, news (with comments and likes), tips knowledge base, bookmarks.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Admins and moderators handle reports, hide content and ban users.
create function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- Instructors and admins publish tips; moderators review suggestions too.
create function private.is_tip_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('instructor', 'moderator', 'admin')
  );
$$;

-- Signed in, onboarding finished and not being deleted.
create function private.is_active_user(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and status = 'active');
$$;

create function private.is_adult(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and age_group = 'adult');
$$;

create function private.slugify(p_text text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    lower(translate(p_text, 'çğıöşüÇĞİÖŞÜâîû', 'cgiosucgiosuaiu')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- News
-- ---------------------------------------------------------------------------

create type public.publish_status as enum ('draft', 'published');

create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  title text not null check (char_length(title) between 3 and 160),
  summary text check (char_length(summary) <= 300),
  body_md text not null default '',
  cover_path text,
  tags text[] not null default '{}',
  members_only boolean not null default false,
  pinned boolean not null default false,
  comments_enabled boolean not null default true,
  notify_on_publish boolean not null default false,
  notified_at timestamptz,
  status public.publish_status not null default 'draft',
  -- A future date with status 'published' means "scheduled".
  published_at timestamptz,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or published_at is not null)
);
create index news_published_idx on public.news (pinned desc, published_at desc) where status = 'published';
alter table public.news enable row level security;
create trigger news_updated_at before update on public.news
  for each row execute function private.set_updated_at();

create function private.news_visible(p_news public.news) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_news.status = 'published'
    and p_news.published_at <= now()
    and (not p_news.members_only or private.is_member_level());
$$;

create policy "news: read published" on public.news
  for select to anon, authenticated using (private.news_visible(news));
create policy "news: admins manage" on public.news
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  hidden_at timestamptz,
  hidden_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index news_comments_news_idx on public.news_comments (news_id, created_at);
alter table public.news_comments enable row level security;
revoke update on public.news_comments from anon, authenticated;
grant update (hidden_at, hidden_by) on public.news_comments to authenticated;

create policy "comments: read visible" on public.news_comments
  for select to anon, authenticated
  using (
    hidden_at is null
    and exists (select 1 from public.news n where n.id = news_id and private.news_visible(n))
  );
create policy "comments: read own" on public.news_comments
  for select to authenticated using (author_id = auth.uid());
create policy "comments: moderators read all" on public.news_comments
  for select to authenticated using (private.is_moderator());
create policy "comments: active users write" on public.news_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_active_user()
    and exists (
      select 1 from public.news n
      where n.id = news_id and n.comments_enabled and private.news_visible(n)
    )
  );
create policy "comments: delete own" on public.news_comments
  for delete to authenticated using (author_id = auth.uid());
create policy "comments: moderators hide" on public.news_comments
  for update to authenticated using (private.is_moderator()) with check (private.is_moderator());
create policy "comments: moderators delete" on public.news_comments
  for delete to authenticated using (private.is_moderator());

create table public.news_likes (
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, user_id)
);
alter table public.news_likes enable row level security;

create policy "likes: read" on public.news_likes
  for select to anon, authenticated
  using (exists (select 1 from public.news n where n.id = news_id and private.news_visible(n)));
create policy "likes: like as self" on public.news_likes
  for insert to authenticated
  with check (
    user_id = auth.uid() and private.is_active_user()
    and exists (select 1 from public.news n where n.id = news_id and private.news_visible(n))
  );
create policy "likes: unlike own" on public.news_likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tips & tricks
-- ---------------------------------------------------------------------------

create type public.tip_category as enum (
  'launching', 'landing', 'thermalling', 'xc', 'weather', 'siv_safety',
  'equipment_care', 'reserve_repacking', 'beginner_faq'
);
create type public.difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.tip_status as enum ('draft', 'pending_review', 'published', 'rejected');

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  title text not null check (char_length(title) between 3 and 160),
  summary text check (char_length(summary) <= 300),
  body_md text not null default '',
  category public.tip_category not null,
  difficulty public.difficulty not null default 'beginner',
  -- YouTube/Vimeo only; we never host video.
  video_url text check (
    video_url is null
    or video_url ~ '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[A-Za-z0-9_\-?=&/]+$'
  ),
  status public.tip_status not null default 'draft',
  published_at timestamptz,
  review_note text,
  author_id uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tips_list_idx on public.tips (category, published_at desc) where status = 'published';
alter table public.tips enable row level security;
create trigger tips_updated_at before update on public.tips
  for each row execute function private.set_updated_at();

create policy "tips: read published" on public.tips
  for select to anon, authenticated using (status = 'published' and published_at <= now());
create policy "tips: authors read own" on public.tips
  for select to authenticated using (author_id = auth.uid());
create policy "tips: editors read all" on public.tips
  for select to authenticated using (private.is_tip_editor());
-- Pilots suggest tips: they can only create drafts or send them for review.
create policy "tips: pilots suggest" on public.tips
  for insert to authenticated
  with check (
    author_id = auth.uid() and private.is_active_user()
    and status in ('draft', 'pending_review') and reviewed_by is null
  );
create policy "tips: authors edit unpublished" on public.tips
  for update to authenticated
  using (author_id = auth.uid() and status in ('draft', 'pending_review', 'rejected'))
  with check (author_id = auth.uid() and status in ('draft', 'pending_review') and reviewed_by is null);
create policy "tips: editors manage" on public.tips
  for all to authenticated using (private.is_tip_editor()) with check (private.is_tip_editor());

create table public.tip_bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  tip_id uuid not null references public.tips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tip_id)
);
alter table public.tip_bookmarks enable row level security;

create policy "bookmarks: own" on public.tip_bookmarks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Content images (news covers). Public: they illustrate public content.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "content: admins upload" on storage.objects
  for all to authenticated
  using (bucket_id = 'content' and private.is_admin())
  with check (bucket_id = 'content' and private.is_admin());
