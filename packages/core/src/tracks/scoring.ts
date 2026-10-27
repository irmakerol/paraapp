import { at } from './at';
import { downsample } from './analyse';
import { distance } from './geo';
import type { TrackPoint } from './types';

/**
 * Cross-country scoring in the style of XContest: free distance via up to three turnpoints,
 * flat triangle and FAI triangle. This is an estimate on a thinned-out track for the logbook;
 * the official score always comes from XContest itself.
 */
export const XC_TYPES = ['free', 'flat', 'fai'] as const;
export type XcType = (typeof XC_TYPES)[number];

export const XC_MULTIPLIER: Record<XcType, number> = { free: 1, flat: 1.2, fai: 1.4 };
/** A triangle counts when start and finish are closer than this share of its perimeter. */
export const XC_MAX_CLOSING = 0.2;
/** FAI triangle: every leg at least this share of the perimeter. */
export const XC_FAI_MIN_LEG = 0.28;

export interface XcPoint {
  lat: number;
  lng: number;
}

export interface XcScore {
  type: XcType;
  /** Scored distance in metres (for triangles: perimeter minus the closing gap). */
  distanceM: number;
  points: number;
  /** Free: start, up to three turnpoints, finish. Triangles: the three corners. */
  turnpoints: XcPoint[];
  /** Triangles: where the closing gap was measured (last point before, first after). */
  closing?: [XcPoint, XcPoint];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pt = (p: TrackPoint): XcPoint => ({ lat: p.lat, lng: p.lng });

function score(type: XcType, distanceM: number) {
  return round2((distanceM / 1000) * XC_MULTIPLIER[type]);
}

/** Planar metres around the track's first point: fast and accurate enough for a search. */
function project(points: TrackPoint[]): { x: Float64Array; y: Float64Array } {
  const origin = at(points, 0);
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const x = new Float64Array(points.length);
  const y = new Float64Array(points.length);
  points.forEach((p, i) => {
    x[i] = (p.lng - origin.lng) * mLng;
    y[i] = (p.lat - origin.lat) * mLat;
  });
  return { x, y };
}

/** Free distance: start → up to 3 turnpoints → finish, points in flight order. */
export function freeDistance(track: TrackPoint[], maxPoints = 800): XcScore | null {
  const points = downsample(track, maxPoints);
  const n = points.length;
  if (n < 2) return null;
  const { x, y } = project(points);
  const d = (i: number, j: number) =>
    Math.hypot((x[i] ?? 0) - (x[j] ?? 0), (y[i] ?? 0) - (y[j] ?? 0));
  const LEGS = 4;
  // best[k][j]: longest path of k legs ending at j; from[k][j]: where its last leg started.
  let prev = new Float64Array(n);
  const from: Int32Array[] = [];
  for (let k = 1; k <= LEGS; k++) {
    const cur = new Float64Array(n);
    const back = new Int32Array(n);
    for (let j = 0; j < n; j++) {
      let best = -1;
      let arg = j;
      for (let i = 0; i <= j; i++) {
        const v = (prev[i] ?? 0) + d(i, j);
        if (v > best) {
          best = v;
          arg = i;
        }
      }
      cur[j] = best;
      back[j] = arg;
    }
    from.push(back);
    prev = cur;
  }
  let end = 0;
  for (let j = 1; j < n; j++) if ((prev[j] ?? 0) > (prev[end] ?? 0)) end = j;
  const chain = [end];
  for (let k = LEGS - 1; k >= 0; k--) chain.unshift(at(from, k)[at(chain, 0)] ?? 0);
  // Merge repeated points (fewer than three turnpoints were worth it).
  const ids = chain.filter((v, i) => i === 0 || v !== chain[i - 1]);
  let metres = 0;
  for (let i = 1; i < ids.length; i++) {
    metres += distance(at(points, at(ids, i - 1)), at(points, at(ids, i)));
  }
  return {
    type: 'free',
    distanceM: Math.round(metres),
    points: score('free', metres),
    turnpoints: ids.map((i) => pt(at(points, i))),
  };
}

/** Best flat and FAI triangles (corners in flight order, closed within XC_MAX_CLOSING). */
export function triangles(
  track: TrackPoint[],
  maxPoints = 260,
): { flat: XcScore | null; fai: XcScore | null } {
  const points = downsample(track, maxPoints);
  const n = points.length;
  if (n < 3) return { flat: null, fai: null };
  const { x, y } = project(points);
  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = Math.hypot((x[i] ?? 0) - (x[j] ?? 0), (y[i] ?? 0) - (y[j] ?? 0));
      dist[i * n + j] = v;
      dist[j * n + i] = v;
    }
  }
  const d = (i: number, j: number) => dist[i * n + j] ?? 0;
  // gap[a][c]: shortest distance between a point at or before a and one at or after c.
  const gap = new Float64Array(n * n);
  const gapArg = new Int32Array(n * n * 2);
  for (let a = 0; a < n; a++) {
    for (let c = n - 1; c >= a; c--) {
      let best = d(a, c);
      let s = a;
      let e = c;
      if (a > 0 && (gap[(a - 1) * n + c] ?? Infinity) < best) {
        best = gap[(a - 1) * n + c] ?? best;
        s = gapArg[((a - 1) * n + c) * 2] ?? s;
        e = gapArg[((a - 1) * n + c) * 2 + 1] ?? e;
      }
      if (c < n - 1 && (gap[a * n + c + 1] ?? Infinity) < best) {
        best = gap[a * n + c + 1] ?? best;
        s = gapArg[(a * n + c + 1) * 2] ?? s;
        e = gapArg[(a * n + c + 1) * 2 + 1] ?? e;
      }
      gap[a * n + c] = best;
      gapArg[(a * n + c) * 2] = s;
      gapArg[(a * n + c) * 2 + 1] = e;
    }
  }

  type Best = { score: number; a: number; b: number; c: number };
  let flat: Best | null = null;
  let fai: Best | null = null;
  for (let a = 0; a < n - 2; a++) {
    for (let c = a + 2; c < n; c++) {
      const ac = d(a, c);
      const g = gap[a * n + c] ?? Infinity;
      for (let b = a + 1; b < c; b++) {
        const ab = d(a, b);
        const bc = d(b, c);
        const perimeter = ab + bc + ac;
        if (perimeter <= 0 || g > XC_MAX_CLOSING * perimeter) continue;
        const net = perimeter - g;
        if (!flat || net * XC_MULTIPLIER.flat > flat.score) {
          flat = { score: net * XC_MULTIPLIER.flat, a, b, c };
        }
        if (
          Math.min(ab, bc, ac) >= XC_FAI_MIN_LEG * perimeter &&
          (!fai || net * XC_MULTIPLIER.fai > fai.score)
        ) {
          fai = { score: net * XC_MULTIPLIER.fai, a, b, c };
        }
      }
    }
  }

  const build = (type: 'flat' | 'fai', best: Best | null): XcScore | null => {
    if (!best) return null;
    const A = at(points, best.a);
    const B = at(points, best.b);
    const C = at(points, best.c);
    const s = at(points, gapArg[(best.a * n + best.c) * 2] ?? best.a);
    const e = at(points, gapArg[(best.a * n + best.c) * 2 + 1] ?? best.c);
    const metres = distance(A, B) + distance(B, C) + distance(C, A) - distance(s, e);
    return {
      type,
      distanceM: Math.round(metres),
      points: score(type, metres),
      turnpoints: [pt(A), pt(B), pt(C)],
      closing: [pt(s), pt(e)],
    };
  };
  return { flat: build('flat', flat), fai: build('fai', fai) };
}

/** The best-scoring of free distance, flat triangle and FAI triangle. */
export function scoreFlight(track: TrackPoint[]): XcScore | null {
  if (track.length < 2) return null;
  const { flat, fai } = triangles(track);
  const candidates = [freeDistance(track), flat, fai].filter((s): s is XcScore => s !== null);
  return candidates.reduce<XcScore | null>(
    (best, s) => (!best || s.points > best.points ? s : best),
    null,
  );
}
