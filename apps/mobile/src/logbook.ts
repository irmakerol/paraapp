import * as FileSystem from 'expo-file-system/legacy';
import { fromCompact, parseIgc, type CompactTrack, type TrackPoint } from '@paraapp/core-tracks';
import { supabase } from './supabase';
import type { LocalFlight } from './tracker/flights';

/** One row of the logbook: a flight from the website's logbook, or one still only on the phone. */
export interface LogbookFlight {
  /** Logbook id, or null for a flight not uploaded yet. */
  id: string | null;
  local: LocalFlight | null;
  startedAt: number;
  durationS: number;
  distanceM: number | null;
  maxAltM: number | null;
  maxClimbMs: number | null;
  site: string | null;
  glider: string | null;
  xcType: string | null;
  xcDistanceM: number | null;
  xcPoints: number | null;
  countedInTotals: boolean;
}

export interface Totals {
  hours: number;
  flights: number;
}

interface FlightRow {
  id: string;
  started_at: string;
  duration_s: number;
  distance_m: number | null;
  max_alt_m: number | null;
  max_climb_ms: number | null;
  site_name: string | null;
  glider: string | null;
  xc_type: string | null;
  xc_distance_m: number | null;
  xc_points: number | null;
  counted_in_totals: boolean;
  site: { name: string } | null;
}

/** The signed-in pilot's logbook (newest first), with flights not uploaded yet mixed in. */
export async function loadLogbook(
  userId: string | null,
  local: LocalFlight[],
): Promise<{ flights: LogbookFlight[]; totals: Totals | null }> {
  const byRemote = new Map(local.filter((f) => f.remoteId).map((f) => [f.remoteId, f]));
  const rows: LogbookFlight[] = local
    .filter((f) => !f.remoteId)
    .map((f) => ({
      id: null,
      local: f,
      startedAt: f.startedAt,
      durationS: f.durationS,
      distanceM: f.distanceM,
      maxAltM: f.maxAltM,
      maxClimbMs: f.maxClimbMs,
      site: null,
      glider: null,
      xcType: null,
      xcDistanceM: null,
      xcPoints: null,
      countedInTotals: false,
    }));
  let totals: Totals | null = null;
  if (userId) {
    const [flights, profile] = await Promise.all([
      supabase
        .from('flights')
        .select(
          'id, started_at, duration_s, distance_m, max_alt_m, max_climb_ms, site_name, glider, xc_type, xc_distance_m, xc_points, counted_in_totals, site:sites!flights_takeoff_site_id_fkey(name)',
        )
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('profiles')
        .select('total_flight_hours, total_flights')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    if (flights.error) throw flights.error;
    for (const r of (flights.data ?? []) as unknown as FlightRow[]) {
      rows.push({
        id: r.id,
        local: byRemote.get(r.id) ?? null,
        startedAt: Date.parse(r.started_at),
        durationS: r.duration_s,
        distanceM: r.distance_m,
        maxAltM: r.max_alt_m,
        maxClimbMs: r.max_climb_ms,
        site: r.site?.name ?? r.site_name,
        glider: r.glider,
        xcType: r.xc_type,
        xcDistanceM: r.xc_distance_m,
        xcPoints: r.xc_points,
        countedInTotals: r.counted_in_totals,
      });
    }
    const p = profile.data as { total_flight_hours: number; total_flights: number } | null;
    if (p) totals = { hours: Number(p.total_flight_hours), flights: p.total_flights };
  }
  rows.sort((a, b) => b.startedAt - a.startedAt);
  return { flights: rows, totals };
}

/** The full track: from the phone's IGC file when there is one, otherwise the owner's stored track. */
export async function loadTrack(flight: LogbookFlight): Promise<TrackPoint[]> {
  if (flight.local) {
    const text = await FileSystem.readAsStringAsync(flight.local.igcUri).catch(() => null);
    if (text) {
      const points = parseIgc(text).points;
      if (points.length > 1) return points;
    }
  }
  if (!flight.id) return [];
  const { data, error } = await supabase
    .from('flight_tracks')
    .select('track')
    .eq('flight_id', flight.id)
    .maybeSingle();
  if (error) throw error;
  const track = (data as { track: CompactTrack } | null)?.track;
  return track ? fromCompact(track) : [];
}

/** Counts a logbook flight in the profile's total hours and flights (once; the server checks). */
export async function addToTotals(flightId: string): Promise<void> {
  const { error } = await supabase.rpc('add_flights_to_totals', { p_flights: [flightId] });
  if (error) throw error;
}
