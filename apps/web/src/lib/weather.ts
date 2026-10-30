import 'server-only';
import {
  dailyConditions,
  openMeteoUrl,
  rateForecast,
  type DayConditions,
  type HourlyForecast,
  type HourRating,
} from '@paraapp/core';
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
/** Today's wind, gusts, direction and rain per site, from cached forecasts only (no fetching). */
export async function cachedTodayConditions(sites: Site[]): Promise<Map<string, DayConditions>> {
  const supabase = await createClient();
  const { data } = await supabase.from('weather_forecasts').select('site_id, data');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  const out = new Map<string, DayConditions>();
  for (const row of data ?? []) {
    const site = sites.find((s) => s.id === row.site_id);
    const hourly = asHourly(row.data);
    if (!site || !hourly) continue;
    const day = dailyConditions(rateForecast(hourly, site.wind_directions)).find(
      (d) => d.date === today,
    );
    if (day) out.set(site.id, day);
  }
  return out;
}
