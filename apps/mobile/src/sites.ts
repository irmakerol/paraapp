import { CONFIG } from './config';
import { supabase } from './supabase';

export interface Site {
  id: string;
  slug: string;
  name: string;
  kind: 'launch' | 'landing' | 'both';
  lat: number;
  lng: number;
  elevationM: number | null;
  windDirections: string[];
  region: string | null;
  description: string;
  rules: string;
}

export interface DayConditions {
  date: string;
  windMinKmh: number | null;
  windMaxKmh: number | null;
  gustMaxKmh: number | null;
  directionDeg: number | null;
  rainMm: number;
}

export interface HourForecast {
  time: string;
  windKmh: number | null;
  gustKmh: number | null;
  directionDeg: number | null;
  precipitation: number | null;
  temperature: number | null;
}

export interface Forecast {
  fetchedAt: string;
  days: DayConditions[];
  hours: HourForecast[];
}

interface SiteRow {
  id: string;
  slug: string;
  name: string;
  kind: Site['kind'];
  lat: number;
  lng: number;
  elevation_m: number | null;
  wind_directions: string[];
  region: string | null;
  description: string;
  rules: string;
}

export async function listSites(): Promise<Site[]> {
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, slug, name, kind, lat, lng, elevation_m, wind_directions, region, description, rules',
    )
    .order('name');
  if (error) throw error;
  return ((data ?? []) as SiteRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    lat: r.lat,
    lng: r.lng,
    elevationM: r.elevation_m,
    windDirections: r.wind_directions,
    region: r.region,
    description: r.description,
    rules: r.rules,
  }));
}

/** The website's cached forecast for a site (the phone never calls the weather service). */
export async function siteForecast(siteId: string): Promise<Forecast | null> {
  const res = await fetch(`${CONFIG.webUrl}/api/mobile/sites/${siteId}/forecast`).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as ({ ok: boolean } & Forecast) | null;
  return body?.ok ? body : null;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
/** Compass point the wind comes from, e.g. 225° → "SW". */
export function compass(deg: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? 'N';
}
