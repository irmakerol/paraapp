import { CONFIG } from './config';
import { locale } from './i18n';
import { supabase } from './supabase';

// Club content read straight from the database with the user's session; RLS decides what each
// person may see (members-only news, drafts, adults-only trips) exactly as on the website.

/** Must match TIP_CATEGORIES / DIFFICULTIES / EVENT_KINDS / RSVP_STATUSES in packages/core. */
export const TIP_CATEGORIES = [
  'launching',
  'landing',
  'thermalling',
  'xc',
  'weather',
  'siv_safety',
  'equipment_care',
  'reserve_repacking',
  'beginner_faq',
] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** Sample records end in "(Ö)"; English shows "(S)" (same as lib/sample.ts on the website). */
export const sample = (text: string) => (locale === 'en' ? text.replace(/\(Ö\)/g, '(S)') : text);

export function publicUrl(bucket: 'content' | 'avatars' | 'ad-photos', path: string | null) {
  if (!path) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}

const tag = () => (locale === 'tr' ? 'tr-TR' : 'en-GB');
export const dateLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(tag(), { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
export const dateTimeLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(tag(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
/** "2026-11-02" → a date without shifting it into another day by time zone. */
export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(tag(), { day: 'numeric', month: 'short' });

/** Other people's names only through the privacy-masked view. */
export async function displayNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from('profile_cards').select('id, display_name').in('id', unique);
  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((r) => [
      r.id,
      sample(r.display_name),
    ]),
  );
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// ---------- News ----------

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover: string | null;
  publishedAt: string | null;
  pinned: boolean;
  membersOnly: boolean;
}

export async function listNews(limit = 40): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, slug, title, summary, cover_path, published_at, pinned, members_only')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      cover_path: string | null;
      published_at: string | null;
      pinned: boolean;
      members_only: boolean;
    }[]
  ).map((n) => ({
    id: n.id,
    slug: n.slug,
    title: sample(n.title),
    summary: n.summary,
    cover: publicUrl('content', n.cover_path),
    publishedAt: n.published_at,
    pinned: n.pinned,
    membersOnly: n.members_only,
  }));
}

export interface Comment {
  id: string;
  authorId: string | null;
  author: string | null;
  body: string;
  createdAt: string;
}

export interface Article extends NewsItem {
  body: string;
  author: string | null;
  commentsEnabled: boolean;
  likes: number;
  liked: boolean;
  comments: Comment[];
}

export async function loadArticle(id: string): Promise<Article | null> {
  const me = await myId();
  const { data } = await supabase.from('news').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const n = data as {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    body_md: string;
    cover_path: string | null;
    published_at: string | null;
    pinned: boolean;
    members_only: boolean;
    comments_enabled: boolean;
    author_id: string | null;
  };
  const [{ count }, mine, { data: rows }] = await Promise.all([
    supabase.from('news_likes').select('news_id', { count: 'exact', head: true }).eq('news_id', id),
    me
      ? supabase
          .from('news_likes')
          .select('news_id')
          .eq('news_id', id)
          .eq('user_id', me)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('news_comments')
      .select('id, author_id, body, created_at')
      .eq('news_id', id)
      .is('hidden_at', null)
      .order('created_at'),
  ]);
  const comments = (rows ?? []) as {
    id: string;
    author_id: string | null;
    body: string;
    created_at: string;
  }[];
  const names = await displayNames([n.author_id, ...comments.map((c) => c.author_id)]);
  return {
    id: n.id,
    slug: n.slug,
    title: sample(n.title),
    summary: n.summary,
    cover: publicUrl('content', n.cover_path),
    publishedAt: n.published_at,
    pinned: n.pinned,
    membersOnly: n.members_only,
    body: n.body_md,
    author: n.author_id ? (names.get(n.author_id) ?? null) : null,
    commentsEnabled: n.comments_enabled,
    likes: count ?? 0,
    liked: Boolean(mine.data),
    comments: comments.map((c) => ({
      id: c.id,
      authorId: c.author_id,
      author: c.author_id ? (names.get(c.author_id) ?? null) : null,
      body: c.body,
      createdAt: c.created_at,
    })),
  };
}

export async function setLike(newsId: string, like: boolean): Promise<void> {
  const me = await myId();
  if (!me) return;
  const { error } = like
    ? await supabase
        .from('news_likes')
        .upsert({ news_id: newsId, user_id: me }, { ignoreDuplicates: true })
    : await supabase.from('news_likes').delete().eq('news_id', newsId).eq('user_id', me);
  if (error) throw error;
}

export async function addComment(newsId: string, body: string): Promise<void> {
  const me = await myId();
  const text = body.trim();
  // Same limits as commentSchema on the website.
  if (!me || text.length < 1 || text.length > 2000) throw new Error('validation');
  const { error } = await supabase
    .from('news_comments')
    .insert({ news_id: newsId, author_id: me, body: text });
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('news_comments').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Ground School (tips) ----------

export interface TipItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: TipCategory;
  difficulty: Difficulty;
  hasVideo: boolean;
}

export interface Tip extends TipItem {
  body: string;
  videoUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  saved: boolean;
}

interface TipRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: TipCategory;
  difficulty: Difficulty;
  video_url: string | null;
}

const tipItem = (r: TipRow): TipItem => ({
  id: r.id,
  slug: r.slug,
  title: sample(r.title),
  summary: r.summary,
  category: r.category,
  difficulty: r.difficulty,
  hasVideo: Boolean(r.video_url),
});

export async function listTips(filter: {
  category?: TipCategory | null;
  difficulty?: Difficulty | null;
  saved?: boolean;
}): Promise<TipItem[]> {
  if (filter.saved) {
    const me = await myId();
    if (!me) return [];
    const { data, error } = await supabase
      .from('tip_bookmarks')
      .select('created_at, tips(id, slug, title, summary, category, difficulty, video_url)')
      .eq('user_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as { tips: TipRow | null }[])
      .map((r) => r.tips)
      .filter((r): r is TipRow => Boolean(r))
      .map(tipItem);
  }
  let query = supabase
    .from('tips')
    .select('id, slug, title, summary, category, difficulty, video_url')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(100);
  if (filter.category) query = query.eq('category', filter.category);
  if (filter.difficulty) query = query.eq('difficulty', filter.difficulty);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as TipRow[]).map(tipItem);
}

export async function loadTip(id: string): Promise<Tip | null> {
  const me = await myId();
  const { data } = await supabase.from('tips').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as TipRow & {
    body_md: string;
    author_id: string | null;
    published_at: string | null;
  };
  const [names, bookmark] = await Promise.all([
    displayNames([r.author_id]),
    me
      ? supabase
          .from('tip_bookmarks')
          .select('tip_id')
          .eq('tip_id', id)
          .eq('user_id', me)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...tipItem(r),
    body: r.body_md,
    videoUrl: r.video_url,
    author: r.author_id ? (names.get(r.author_id) ?? null) : null,
    publishedAt: r.published_at,
    saved: Boolean(bookmark.data),
  };
}

export async function setSaved(tipId: string, saved: boolean): Promise<void> {
  const me = await myId();
  if (!me) return;
  const { error } = saved
    ? await supabase
        .from('tip_bookmarks')
        .upsert({ tip_id: tipId, user_id: me }, { ignoreDuplicates: true })
    : await supabase.from('tip_bookmarks').delete().eq('tip_id', tipId).eq('user_id', me);
  if (error) throw error;
}

/** Only YouTube and Vimeo links are offered, opened in their own app (nothing loads before a tap). */
export function videoLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\./, '');
    return ['youtube.com', 'youtu.be', 'vimeo.com', 'youtube-nocookie.com'].includes(host)
      ? url
      : null;
  } catch {
    return null;
  }
}

// ---------- Events ----------

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  status: 'published' | 'cancelled';
  membersOnly: boolean;
  place: string | null;
}

export interface EventDetail extends EventItem {
  description: string;
  capacity: number | null;
  rsvpDeadline: string | null;
  going: number;
  maybe: number;
  mine: RsvpStatus | null;
  note: string;
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  status: 'published' | 'cancelled';
  members_only: boolean;
  location_text: string | null;
  sites: { name: string } | null;
}

const eventItem = (e: EventRow): EventItem => ({
  id: e.id,
  slug: e.slug,
  title: sample(e.title),
  kind: e.kind,
  startsAt: e.starts_at,
  endsAt: e.ends_at,
  status: e.status,
  membersOnly: e.members_only,
  place: [e.sites?.name, e.location_text].filter(Boolean).join(' · ') || null,
});

export async function listEvents(past: boolean, limit = 100): Promise<EventItem[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from('events')
    .select(
      'id, slug, title, kind, starts_at, ends_at, status, members_only, location_text, sites:site_id(name)',
    )
    .in('status', ['published', 'cancelled'])
    .limit(limit);
  query = past
    ? query.lt('ends_at', now).order('starts_at', { ascending: false })
    : query.gte('ends_at', now).order('starts_at');
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as EventRow[]).map(eventItem);
}

export async function loadEvent(id: string): Promise<EventDetail | null> {
  const me = await myId();
  const { data } = await supabase
    .from('events')
    .select('*, sites:site_id(name)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const e = data as unknown as EventRow & {
    description_md: string;
    capacity: number | null;
    rsvp_deadline: string | null;
  };
  const [{ data: counts }, mine] = await Promise.all([
    supabase.rpc('event_counts', { p_event: id }),
    me
      ? supabase
          .from('event_rsvps')
          .select('status, note')
          .eq('event_id', id)
          .eq('user_id', me)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const c = ((counts ?? []) as { going: number; maybe: number }[])[0];
  const m = mine.data as { status: RsvpStatus; note: string | null } | null;
  return {
    ...eventItem(e),
    description: e.description_md,
    capacity: e.capacity,
    rsvpDeadline: e.rsvp_deadline,
    going: Number(c?.going ?? 0),
    maybe: Number(c?.maybe ?? 0),
    mine: m?.status ?? null,
    note: m?.note ?? '',
  };
}

/** Throws Error('events.full' | 'events.closed' | 'generic'). */
export async function rsvp(
  eventId: string,
  status: RsvpStatus | 'withdraw',
  note = '',
): Promise<void> {
  const me = await myId();
  if (!me) throw new Error('generic');
  const { error } =
    status === 'withdraw'
      ? await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', me)
      : await supabase.from('event_rsvps').upsert({
          event_id: eventId,
          user_id: me,
          status,
          note: note.trim().slice(0, 300) || null,
        });
  if (error) {
    if (error.message.includes('event_full')) throw new Error('events.full');
    if (error.message.includes('rsvp_closed')) throw new Error('events.closed');
    throw new Error('generic');
  }
}

export function rsvpOpen(e: EventDetail, now = Date.now()): boolean {
  return (
    e.status === 'published' &&
    new Date(e.endsAt).getTime() > now &&
    (!e.rsvpDeadline || new Date(e.rsvpDeadline).getTime() > now)
  );
}

// ---------- Safety lessons ----------

export interface LessonItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  severity: string;
  publishedAt: string | null;
}

export async function listLessons(): Promise<LessonItem[]> {
  const { data, error } = await supabase
    .from('safety_lessons')
    .select('id, title, summary, category, severity, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      title: string;
      summary: string | null;
      category: string;
      severity: string;
      published_at: string | null;
    }[]
  ).map((l) => ({
    id: l.id,
    title: sample(l.title),
    summary: l.summary,
    category: l.category,
    severity: l.severity,
    publishedAt: l.published_at,
  }));
}

export async function loadLessonBody(id: string): Promise<string> {
  const { data } = await supabase
    .from('safety_lessons')
    .select('body_md')
    .eq('id', id)
    .maybeSingle();
  return (data as { body_md: string } | null)?.body_md ?? '';
}
