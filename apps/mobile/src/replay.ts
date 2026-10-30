import type { TrackPoint } from '@paraapp/core-tracks';

/** Where the glider is at a moment of the replay, between two recorded fixes. */
export interface ReplayFrame {
  lat: number;
  lng: number;
  alt: number;
  /** Degrees clockwise from north, smoothed over the last few seconds. */
  heading: number;
  /** m/s over the last ~5 s */
  climb: number;
  /** km/h over the last ~5 s */
  speed: number;
  /** Index of the last fix at or before this moment. */
  index: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Last index whose time is <= t (binary search); 0 before the start. */
export function indexAt(points: readonly TrackPoint[], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((points[mid]?.t ?? 0) <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function frameAt(points: readonly TrackPoint[], t: number): ReplayFrame | null {
  const first = points[0];
  if (!first) return null;
  const i = indexAt(points, t);
  const a = points[i] ?? first;
  const b = points[i + 1];
  const f = b && b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const lat = b ? a.lat + (b.lat - a.lat) * f : a.lat;
  const lng = b ? a.lng + (b.lng - a.lng) * f : a.lng;
  const alt = b ? a.alt + (b.alt - a.alt) * f : a.alt;

  // Look back ~5 s for climb, speed and a steady heading.
  let j = i;
  while (j > 0 && a.t - (points[j - 1]?.t ?? a.t) <= 5_000) j--;
  const back = points[j] ?? a;
  const ahead = b ?? a;
  const dt = (ahead.t - back.t) / 1000;
  const climb = dt > 0 ? (ahead.alt - back.alt) / dt : 0;
  const speed = dt > 0 ? (metres(back, ahead) / dt) * 3.6 : 0;
  const heading = metres(back, ahead) > 3 ? bearing(back, ahead) : 0;
  return { lat, lng, alt, heading, climb, speed, index: i };
}

/** Altitude profile reduced to `bars` values (max per bucket), for the scrub graph. */
export function altitudeBars(points: readonly TrackPoint[], bars: number): number[] {
  if (points.length === 0 || bars <= 0) return [];
  const out: number[] = [];
  const size = points.length / bars;
  for (let b = 0; b < bars; b++) {
    let max = -Infinity;
    const end = Math.min(points.length, Math.ceil((b + 1) * size));
    for (let i = Math.floor(b * size); i < end; i++) max = Math.max(max, points[i]?.alt ?? max);
    out.push(Number.isFinite(max) ? max : (out[out.length - 1] ?? 0));
  }
  return out;
}
