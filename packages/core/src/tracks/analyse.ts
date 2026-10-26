import { at } from './at';
import { distance } from './geo';
import type { CompactPoint, CompactTrack, TrackPoint } from './types';

/** Ground speed above which we consider the pilot flying (≈ 14 km/h). */
const FLYING_SPEED_MS = 4;
/** Speed must stay above the threshold this long to count as a takeoff. */
const SUSTAIN_S = 30;
/** Window for vario smoothing, seconds either side. */
const VARIO_HALF_WINDOW_S = 5;

export interface FlightStats {
  startedAt: number;
  endedAt: number;
  durationS: number;
  /** Length of the flown path, metres. */
  distanceM: number;
  /** Takeoff to landing, metres. */
  straightM: number;
  /** Furthest point from takeoff, metres. */
  maxFromTakeoffM: number;
  takeoffAltM: number;
  landingAltM: number;
  maxAltM: number;
  minAltM: number;
  /** Highest / lowest smoothed vertical speed, m/s. */
  maxClimbMs: number;
  maxSinkMs: number;
  takeoff: TrackPoint;
  landing: TrackPoint;
}

export interface AnalysedFlight {
  stats: FlightStats;
  /** The flight portion only (takeoff to landing). */
  points: TrackPoint[];
}

/** Drops broken fixes, sorts by time and removes duplicate timestamps. */
export function cleanPoints(points: TrackPoint[]): TrackPoint[] {
  const valid = points
    .filter(
      (p) =>
        Number.isFinite(p.t) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180 &&
        !(p.lat === 0 && p.lng === 0) &&
        Number.isFinite(p.alt) &&
        p.alt > -500 &&
        p.alt < 12_000,
    )
    .sort((a, b) => a.t - b.t);
  const out: TrackPoint[] = [];
  for (const p of valid) {
    const prev = out[out.length - 1];
    if (prev && p.t === prev.t) continue;
    // Teleports (> 300 km/h between fixes) are GPS glitches.
    if (prev && distance(prev, p) / ((p.t - prev.t) / 1000) > 85) continue;
    out.push(p);
  }
  return out;
}

/** Ground speed at each point, averaged over ±10 s. */
function groundSpeeds(points: TrackPoint[]): number[] {
  const speeds: number[] = [];
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < points.length; i++) {
    const t = at(points, i).t;
    while (at(points, lo).t < t - 10_000) lo++;
    while (hi + 1 < points.length && at(points, hi + 1).t <= t + 10_000) hi++;
    const dt = (at(points, hi).t - at(points, lo).t) / 1000;
    speeds.push(dt > 0 ? distance(at(points, lo), at(points, hi)) / dt : 0);
  }
  return speeds;
}

/**
 * Finds takeoff and landing: the first and last moments the pilot moves faster than walking
 * pace for at least 30 seconds. Falls back to the whole track (e.g. for hike-and-fly GPX
 * files without a clear launch).
 */
export function detectFlight(points: TrackPoint[]): { from: number; to: number } {
  if (points.length < 2) return { from: 0, to: Math.max(0, points.length - 1) };
  const speeds = groundSpeeds(points);
  const sustainedFrom = (i: number, dir: 1 | -1) => {
    const t0 = at(points, i).t;
    for (let j = i; j >= 0 && j < points.length; j += dir) {
      if (at(speeds, j) < FLYING_SPEED_MS) return false;
      if (Math.abs(at(points, j).t - t0) >= SUSTAIN_S * 1000) return true;
    }
    return false;
  };
  let from = -1;
  for (let i = 0; i < points.length; i++) {
    if (at(speeds, i) >= FLYING_SPEED_MS && sustainedFrom(i, 1)) {
      from = i;
      break;
    }
  }
  let to = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (at(speeds, i) >= FLYING_SPEED_MS && sustainedFrom(i, -1)) {
      to = i;
      break;
    }
  }
  if (from < 0 || to <= from) return { from: 0, to: points.length - 1 };
  return { from, to };
}

/** Vertical speed at each point, m/s, smoothed over ±5 s. */
export function varioSeries(points: { t: number; alt: number }[]): number[] {
  const out: number[] = [];
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < points.length; i++) {
    const t = at(points, i).t;
    while (at(points, lo).t < t - VARIO_HALF_WINDOW_S * 1000) lo++;
    while (hi + 1 < points.length && at(points, hi + 1).t <= t + VARIO_HALF_WINDOW_S * 1000) hi++;
    const dt = (at(points, hi).t - at(points, lo).t) / 1000;
    out.push(dt > 0 ? (at(points, hi).alt - at(points, lo).alt) / dt : 0);
  }
  return out;
}

/** Path length, sampling at least every 5 s so GPS jitter doesn't inflate it. */
function pathLength(points: TrackPoint[]): number {
  let total = 0;
  let last = points[0];
  for (const p of points) {
    if (!last) break;
    if (p.t - last.t >= 5000 || p === points[points.length - 1]) {
      total += distance(last, p);
      last = p;
    }
  }
  return total;
}

export function analyseTrack(raw: TrackPoint[]): AnalysedFlight | null {
  const clean = cleanPoints(raw);
  if (clean.length < 10) return null;
  const { from, to } = detectFlight(clean);
  const points = clean.slice(from, to + 1);
  if (points.length < 2) return null;
  const takeoff = at(points, 0);
  const landing = at(points, points.length - 1);
  const vario = varioSeries(points);
  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let maxFrom = 0;
  for (const p of points) {
    maxAlt = Math.max(maxAlt, p.alt);
    minAlt = Math.min(minAlt, p.alt);
    maxFrom = Math.max(maxFrom, distance(takeoff, p));
  }
  return {
    points,
    stats: {
      startedAt: takeoff.t,
      endedAt: landing.t,
      durationS: Math.round((landing.t - takeoff.t) / 1000),
      distanceM: Math.round(pathLength(points)),
      straightM: Math.round(distance(takeoff, landing)),
      maxFromTakeoffM: Math.round(maxFrom),
      takeoffAltM: Math.round(takeoff.alt),
      landingAltM: Math.round(landing.alt),
      maxAltM: Math.round(maxAlt),
      minAltM: Math.round(minAlt),
      maxClimbMs: round1(Math.max(...vario)),
      maxSinkMs: round1(Math.min(...vario)),
      takeoff,
      landing,
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Downsamples to at most `maxPoints` by time (keeps the shape for both the map and the
 * altitude chart), always keeping the last point.
 */
export function downsample(points: TrackPoint[], maxPoints = 2000): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const first = at(points, 0);
  const last = at(points, points.length - 1);
  const step = (last.t - first.t) / (maxPoints - 1);
  const out: TrackPoint[] = [];
  let next = first.t;
  for (const p of points) {
    if (p.t >= next) {
      out.push(p);
      next = p.t + step;
    }
  }
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Removes everything within `metres` of the start and of the end, so a public track never
 * shows where a pilot set off from or landed (often near home).
 */
export function trimEnds(points: TrackPoint[], metres: number): TrackPoint[] {
  if (points.length === 0) return points;
  const first = at(points, 0);
  const last = at(points, points.length - 1);
  let from = 0;
  while (from < points.length && distance(first, at(points, from)) < metres) from++;
  let to = points.length - 1;
  while (to >= from && distance(last, at(points, to)) < metres) to--;
  return from <= to ? points.slice(from, to + 1) : [];
}

export function toCompact(points: TrackPoint[]): CompactTrack {
  const start = points[0]?.t ?? 0;
  return {
    start,
    points: points.map((p): CompactPoint => [
      Math.round((p.t - start) / 1000),
      Math.round(p.lat * 1e5) / 1e5,
      Math.round(p.lng * 1e5) / 1e5,
      Math.round(p.alt),
    ]),
  };
}

export function fromCompact(track: CompactTrack): TrackPoint[] {
  return track.points.map(([s, lat, lng, alt]) => ({ t: track.start + s * 1000, lat, lng, alt }));
}
