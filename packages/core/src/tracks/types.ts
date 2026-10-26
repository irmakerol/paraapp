/** One GPS fix. `t` is epoch milliseconds (UTC), `alt` metres above sea level. */
export interface TrackPoint {
  t: number;
  lat: number;
  lng: number;
  alt: number;
}

export interface ParsedTrack {
  source: 'igc' | 'gpx';
  points: TrackPoint[];
  pilot?: string;
  glider?: string;
}

/**
 * Compact form stored in the database and sent to the browser:
 * [seconds since the first point, lat, lng, altitude].
 */
export type CompactPoint = [number, number, number, number];

export interface CompactTrack {
  /** Epoch ms of the first point. */
  start: number;
  points: CompactPoint[];
}
