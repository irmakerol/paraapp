import { z } from 'zod';

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

export const REPORT_REASONS = [
  'spam',
  'scam',
  'harassment',
  'hate',
  'sexual',
  'dangerous',
  'illegal',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGETS = [
  'ad',
  'user',
  'chat',
  'message',
  'news_comment',
  'tip',
  'ride',
  'event',
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** URL-safe slug; Turkish letters are transliterated. Mirrors `private.slugify()` in SQL. */
export function slugify(text: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    â: 'a',
    î: 'i',
    û: 'u',
    Ç: 'c',
    Ğ: 'g',
    İ: 'i',
    Ö: 'o',
    Ş: 's',
    Ü: 'u',
  };
  return text
    .replace(/[çğıöşüâîûÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Turns a YouTube or Vimeo link into a privacy-friendly embed URL, or null if unsupported.
 * We never host video ourselves.
 */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./, '');
  const idPattern = /^[A-Za-z0-9_-]{6,20}$/;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = parsed.searchParams.get('v');
    return id && idPattern.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return idPattern.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    return /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}?dnt=1` : null;
  }
  return null;
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const newsSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  locale: z.enum(['tr', 'en']),
  summary: text(300),
  body_md: z.string().max(50_000),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  members_only: z.boolean(),
  pinned: z.boolean(),
  comments_enabled: z.boolean(),
  notify_on_publish: z.boolean(),
  status: z.enum(['draft', 'published']),
  published_at: z.string().datetime({ offset: true }).nullable(),
});

export const tipSchema = z.object({
  title: z.string().trim().min(3).max(160),
  locale: z.enum(['tr', 'en']),
  summary: text(300),
  body_md: z.string().trim().min(20).max(30_000),
  category: z.enum(TIP_CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  video_url: text(300).refine((v) => !v || videoEmbedUrl(v) !== null, { message: 'video' }),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const reportSchema = z.object({
  target_type: z.enum(REPORT_TARGETS),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: text(2000),
});
