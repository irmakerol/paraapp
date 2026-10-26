import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getEvent = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('*, sites:site_id(name, slug)')
    .eq('slug', slug)
    .maybeSingle();
  return data;
});

export function eventLocation(e: { location_text: string | null; sites: { name: string } | null }) {
  return [e.sites?.name, e.location_text].filter(Boolean).join(', ') || null;
}
