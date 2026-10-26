import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import type { CompactTrack } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';

export const FLIGHT_LIST_COLUMNS =
  'id, started_at, duration_s, distance_m, max_alt_m, visibility, source, site_name, glider, takeoff_site_id, sites:takeoff_site_id(name, slug)';

export interface FlightListItem {
  id: string;
  startedAt: string;
  durationS: number;
  distanceM: number | null;
  maxAltM: number | null;
  visibility: string;
  source: string;
  site: string | null;
  glider: string | null;
}

/** Flights of one pilot that the viewer may see (RLS decides), newest first. */
export async function listFlights(userId: string, limit = 2000): Promise<FlightListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('flights')
    .select(FLIGHT_LIST_COLUMNS)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((f) => ({
    id: f.id,
    startedAt: f.started_at,
    durationS: f.duration_s,
    distanceM: f.distance_m,
    maxAltM: f.max_alt_m,
    visibility: f.visibility,
    source: f.source,
    site: f.sites?.name ?? f.site_name,
    glider: f.glider,
  }));
}

export async function pilotStats(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('pilot_stats', { p_user: userId });
  return data?.[0] ?? null;
}

const FLIGHT_COLUMNS =
  '*, takeoff:takeoff_site_id(name, slug), landing:landing_site_id(name, slug), wing:wing_id(brand, model, size)';

/** One flight if the viewer may see it (RLS decides). Cached per request. */
export const getFlight = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('flights').select(FLIGHT_COLUMNS).eq('id', id).maybeSingle();
  return data;
});

export type FlightDetail = NonNullable<Awaited<ReturnType<typeof getFlight>>>;

function asTrack(value: unknown): CompactTrack | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as CompactTrack;
  return typeof t.start === 'number' && Array.isArray(t.points) && t.points.length > 1 ? t : null;
}

/**
 * The track this viewer may see: the full one for the owner (RLS allows only them to read
 * flight_tracks), otherwise the copy with the first and last 500 m removed.
 */
export async function visibleTrack(
  flight: FlightDetail,
  viewerId: string | undefined,
): Promise<{ track: CompactTrack | null; trimmed: boolean }> {
  if (viewerId && viewerId === flight.user_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('flight_tracks')
      .select('track')
      .eq('flight_id', flight.id)
      .maybeSingle();
    const full = asTrack(data?.track);
    if (full) return { track: full, trimmed: false };
  }
  return { track: asTrack(flight.public_track), trimmed: true };
}

export function siteLabel(flight: Pick<FlightDetail, 'takeoff' | 'site_name'>): string | null {
  return flight.takeoff?.name ?? flight.site_name;
}
