import 'server-only';
import { openMeteoUrl, rateForecast, type HourlyForecast, type HourRating } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { Json } from '@/lib/supabase/database.types';

const FRESH_MS = 60 * 60 * 1000;

interface Site {
  id: string;
  lat: number;
  lng: number;
  wind_directions: string[];
}

function asHourly(data: unknown): HourlyForecast | null {
  const hourly = (data as { hourly?: HourlyForecast } | null)?.hourly;
  return hourly && Array.isArray(hourly.time) ? hourly : null;
}

/**
 * Forecast for a site, rated for flying. Served from the shared cache when it is less than an
 * hour old, otherwise fetched from Open-Meteo by the server (the browser never contacts it).
 * Returns stale data, or null, when Open-Meteo cannot be reached.
 */
export async function siteForecast(
  site: Site,
): Promise<{ hours: HourRating[]; fetchedAt: string } | null> {
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from('weather_forecasts')
    .select('data, fetched_at')
    .eq('site_id', site.id)
    .maybeSingle();
  let hourly = cached ? asHourly(cached.data) : null;
  let fetchedAt = cached?.fetched_at ?? null;

  if (!fetchedAt || Date.now() - new Date(fetchedAt).getTime() > FRESH_MS) {
    try {
      const res = await fetch(openMeteoUrl(site.lat, site.lng, 3, serverEnv().OPEN_METEO_URL), {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as unknown;
        const fresh = asHourly(json);
        if (fresh) {
          hourly = fresh;
          fetchedAt = new Date().toISOString();
          await createAdminClient()
            .from('weather_forecasts')
            .upsert({
              site_id: site.id,
              data: { hourly: fresh } as unknown as Json,
              fetched_at: fetchedAt,
            });
        }
      }
    } catch {
      // Keep whatever we had.
    }
  }
  if (!hourly || !fetchedAt) return null;
  return { hours: rateForecast(hourly, site.wind_directions), fetchedAt };
}

/** Today's best rating per site from the cache only (no fetching), for lists. */
export async function cachedTodayRatings(
  sites: Site[],
): Promise<Map<string, HourRating['rating']>> {
  const supabase = await createClient();
  const { data } = await supabase.from('weather_forecasts').select('site_id, data');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  const rank = { no: 0, marginal: 1, good: 2 } as const;
  const out = new Map<string, HourRating['rating']>();
  for (const row of data ?? []) {
    const site = sites.find((s) => s.id === row.site_id);
    const hourly = asHourly(row.data);
    if (!site || !hourly) continue;
    let best: HourRating['rating'] | null = null;
    for (const h of rateForecast(hourly, site.wind_directions)) {
      const hour = Number(h.time.slice(11, 13));
      if (!h.time.startsWith(today) || hour < 9 || hour > 18) continue;
      if (best === null || rank[h.rating] > rank[best]) best = h.rating;
    }
    if (best) out.set(site.id, best);
  }
  return out;
}
