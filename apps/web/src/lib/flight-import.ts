import 'server-only';
import { createHash } from 'node:crypto';
import {
  APP_CONFIG,
  MAX_TRACK_FILE_BYTES,
  analyseTrack,
  detectFormat,
  downsample,
  parseTrack,
  scoreFlight,
  toCompact,
  trimEnds,
} from '@paraapp/core';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Viewer } from '@/lib/session';
import type { Json } from '@/lib/supabase/database.types';

const json = (value: unknown) => value as Json;

export type ImportResult =
  | { ok: true; id: string; startedAt: string; durationS: number; siteName: string | null }
  | {
      ok: false;
      error: 'tooLarge' | 'unsupported' | 'noFlight' | 'duplicate' | 'generic';
      id?: string;
    };

/**
 * Analyses an uploaded IGC/GPX file on the server and stores the flight. Stats are computed
 * here, never taken from the browser, so records can be trusted. Written with the service
 * role because users cannot insert imported flights themselves (see the flights RLS).
 */
export async function importTrack(viewer: Viewer, file: File): Promise<ImportResult> {
  if (file.size > MAX_TRACK_FILE_BYTES) return { ok: false, error: 'tooLarge' };
  const text = await file.text();
  const format = detectFormat(file.name, text);
  if (!format) return { ok: false, error: 'unsupported' };
  const parsed = parseTrack(file.name, text);
  const flight = parsed ? analyseTrack(parsed.points) : null;
  if (!parsed || !flight) return { ok: false, error: 'noFlight' };

  const admin = createAdminClient();
  const userId = viewer.user.id;
  const sha256 = createHash('sha256').update(text).digest('hex');
  const { data: existing } = await admin
    .from('flights')
    .select('id')
    .eq('user_id', userId)
    .eq('file_sha256', sha256)
    .maybeSingle();
  if (existing) return { ok: false, error: 'duplicate', id: existing.id };

  const { stats } = flight;
  const [takeoffSite, landingSite] = await Promise.all([
    admin.rpc('nearest_site', { p_lat: stats.takeoff.lat, p_lng: stats.takeoff.lng }),
    admin.rpc('nearest_site', { p_lat: stats.landing.lat, p_lng: stats.landing.lng }),
  ]);
  const points = downsample(flight.points, 2000);
  const publicPoints = trimEnds(points, APP_CONFIG.publicTrackTrimMetres);
  // Scored on the stored (thinned) track so the flight page can redraw the same result.
  const xc = scoreFlight(points);

  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${format}`;
  const upload = await admin.storage.from('flight-files').upload(path, text, {
    contentType: format === 'gpx' ? 'application/gpx+xml' : 'text/plain',
  });
  if (upload.error) return { ok: false, error: 'generic' };

  const { error } = await admin.from('flights').insert({
    id,
    user_id: userId,
    started_at: new Date(stats.startedAt).toISOString(),
    duration_s: stats.durationS,
    takeoff_site_id: takeoffSite.data ?? null,
    landing_site_id: landingSite.data ?? null,
    glider: parsed.glider ?? null,
    distance_m: stats.distanceM,
    straight_m: stats.straightM,
    max_from_takeoff_m: stats.maxFromTakeoffM,
    takeoff_alt_m: stats.takeoffAltM,
    landing_alt_m: stats.landingAltM,
    max_alt_m: stats.maxAltM,
    min_alt_m: stats.minAltM,
    max_climb_ms: stats.maxClimbMs,
    max_sink_ms: stats.maxSinkMs,
    // Adults: public by default (decision 2026-10-26); the database makes minors' flights private.
    visibility: viewer.profile.age_group === 'adult' ? 'public' : 'private',
    source: format,
    file_path: path,
    file_sha256: sha256,
    public_track: publicPoints.length > 1 ? json(toCompact(publicPoints)) : null,
    xc_type: xc?.type ?? null,
    xc_distance_m: xc?.distanceM ?? null,
    xc_points: xc?.points ?? null,
  });
  if (error) {
    await admin.storage.from('flight-files').remove([path]);
    return { ok: false, error: error.code === '23505' ? 'duplicate' : 'generic' };
  }
  const { error: trackError } = await admin.from('flight_tracks').insert({
    flight_id: id,
    user_id: userId,
    track: json(toCompact(points)),
    takeoff_lat: stats.takeoff.lat,
    takeoff_lng: stats.takeoff.lng,
    landing_lat: stats.landing.lat,
    landing_lng: stats.landing.lng,
  });
  if (trackError) {
    await admin.from('flights').delete().eq('id', id);
    await admin.storage.from('flight-files').remove([path]);
    return { ok: false, error: 'generic' };
  }

  let siteName: string | null = null;
  if (takeoffSite.data) {
    const { data } = await admin.from('sites').select('name').eq('id', takeoffSite.data).single();
    siteName = data?.name ?? null;
  }
  return {
    ok: true,
    id,
    startedAt: new Date(stats.startedAt).toISOString(),
    durationS: stats.durationS,
    siteName,
  };
}
