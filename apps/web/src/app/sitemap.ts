import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { publicEnv } from '@/lib/env';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;

const SECTIONS = ['', '/news', '/tips', '/market', '/sites', '/events', '/safety', '/sos'];

/**
 * Public pages only, read as a guest so RLS keeps out drafts, members-only content and anything
 * private. Flights and pilot pages are left out on purpose: they are about people.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const entries: MetadataRoute.Sitemap = routing.locales.flatMap((l) =>
    SECTIONS.map((s) => ({ url: `${base}/${l}${s}`, changeFrequency: 'daily' as const })),
  );
  const supabase = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  try {
    const [news, tips, sites, events, lessons] = await Promise.all([
      supabase
        .from('news')
        .select('slug, locale, updated_at')
        .eq('status', 'published')
        .limit(5000),
      supabase
        .from('tips')
        .select('slug, locale, updated_at')
        .eq('status', 'published')
        .limit(5000),
      supabase.from('sites').select('slug, updated_at').limit(5000),
      supabase.from('events').select('slug, updated_at').eq('status', 'published').limit(5000),
      supabase
        .from('safety_lessons')
        .select('slug, locale, updated_at')
        .eq('status', 'published')
        .limit(5000),
    ]);
    for (const n of news.data ?? []) {
      entries.push({ url: `${base}/${n.locale}/news/${n.slug}`, lastModified: n.updated_at });
    }
    for (const t of tips.data ?? []) {
      entries.push({ url: `${base}/${t.locale}/tips/${t.slug}`, lastModified: t.updated_at });
    }
    for (const l of lessons.data ?? []) {
      entries.push({
        url: `${base}/${l.locale}/safety/lessons/${l.slug}`,
        lastModified: l.updated_at,
      });
    }
    for (const locale of routing.locales) {
      for (const s of sites.data ?? []) {
        entries.push({ url: `${base}/${locale}/sites/${s.slug}`, lastModified: s.updated_at });
      }
      for (const e of events.data ?? []) {
        entries.push({ url: `${base}/${locale}/events/${e.slug}`, lastModified: e.updated_at });
      }
    }
  } catch {
    // Database unreachable: the static sections are still listed.
  }
  return entries;
}
