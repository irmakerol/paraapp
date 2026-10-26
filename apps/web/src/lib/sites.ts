import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getSite = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('sites').select('*').eq('slug', slug).maybeSingle();
  return data;
});

export async function listSites() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sites')
    .select('id, slug, name, kind, lat, lng, elevation_m, region, wind_directions, verified')
    .order('name');
  return data ?? [];
}
