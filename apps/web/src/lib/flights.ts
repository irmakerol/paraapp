import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { fromCompact, scoreFlight, type CompactTrack, type XcScore } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayNames } from '@/lib/people';

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

/**
 * The cross-country score drawn for the owner, from their full track. Flights imported before
 * scoring existed get their numbers saved now (the service role writes them, as at import).
 */
export async function ownerScore(
  flight: FlightDetail,
  track: CompactTrack | null,
): Promise<XcScore | null> {
  if (!track || flight.source === 'manual') return null;
  const xc = scoreFlight(fromCompact(track));
  if (xc && flight.xc_type === null) {
    await createAdminClient()
      .from('flights')
      .update({ xc_type: xc.type, xc_distance_m: xc.distanceM, xc_points: xc.points })
      .eq('id', flight.id)
      .is('xc_type', null);
  }
  return xc;
}

export interface SameDayFlight {
  id: string;
  name: string | null;
  startedAt: string;
}

/** Other flights from the same takeoff on the same (Türkiye) day that the viewer may see. */
export async function sameDayFlights(flight: FlightDetail): Promise<SameDayFlight[]> {
  if (!flight.takeoff_site_id) return [];
  // Türkiye is UTC+3 all year.
  const day = new Date(new Date(flight.started_at).getTime() + 3 * 3_600_000)
    .toISOString()
    .slice(0, 10);
  const from = new Date(`${day}T00:00:00+03:00`);
  const to = new Date(from.getTime() + 86_400_000);
  const supabase = await createClient();
  const { data } = await supabase
    .from('flights')
    .select('id, user_id, started_at')
    .eq('takeoff_site_id', flight.takeoff_site_id)
    .gte('started_at', from.toISOString())
    .lt('started_at', to.toISOString())
    .neq('id', flight.id)
    .not('public_track', 'is', null)
    .order('started_at')
    .limit(12);
  const rows = data ?? [];
  const names = await displayNames(supabase, [...new Set(rows.map((r) => r.user_id))]);
  return rows.map((r) => ({
    id: r.id,
    name: names.get(r.user_id) ?? null,
    startedAt: r.started_at,
  }));
}
