import { describe, expect, it } from 'vitest';
import { freeDistance, scoreFlight, triangles, XC_MULTIPLIER } from './scoring';
import { distance } from './geo';
import type { TrackPoint } from './types';
import { at } from './at';

function need<T>(v: T | null | undefined): T {
  if (v == null) throw new Error('missing');
  return v;
}

const T0 = Date.UTC(2026, 5, 14, 9, 0, 0);
const LAT0 = 36.53;
const LNG0 = 29.19;
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

/** Flies straight lines between the given corners (metres east/north of the start), 1 point/s at 10 m/s. */
function path(corners: [number, number][]): TrackPoint[] {
  const out: TrackPoint[] = [];
  let t = T0;
  for (let k = 1; k < corners.length; k++) {
    const [x0, y0] = at(corners, k - 1);
    const [x1, y1] = at(corners, k);
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10));
    for (let s = k === 1 ? 0 : 1; s <= steps; s++) {
      const f = s / steps;
      out.push({
        t,
        lat: LAT0 + (y0 + (y1 - y0) * f) / M_LAT,
        lng: LNG0 + (x0 + (x1 - x0) * f) / M_LNG,
        alt: 1500,
      });
      t += 1000;
    }
  }
  return out;
}

describe('XC scoring', () => {
  it('scores a straight line as free distance', () => {
    const track = path([
      [0, 0],
      [20_000, 0],
    ]);
    const s = need(scoreFlight(track));
    expect(s.type).toBe('free');
    expect(s.distanceM).toBeGreaterThan(19_800);
    expect(s.distanceM).toBeLessThan(20_200);
    expect(s.points).toBeCloseTo(s.distanceM / 1000, 1);
  });

  it('uses turnpoints for a dog-leg', () => {
    const track = path([
      [0, 0],
      [10_000, 0],
      [10_000, 10_000],
    ]);
    const s = need(freeDistance(track));
    expect(s.distanceM).toBeGreaterThan(19_500);
    expect(s.turnpoints.length).toBeGreaterThanOrEqual(3);
  });

  it('finds a closed FAI triangle and prefers it', () => {
    // Equilateral-ish triangle with 10 km legs, back to the start.
    const h = 8_660;
    const track = path([
      [0, 0],
      [10_000, 0],
      [5_000, h],
      [0, 0],
    ]);
    const { flat, fai } = triangles(track);
    expect(fai).not.toBeNull();
    expect(flat).not.toBeNull();
    expect(need(fai).distanceM).toBeGreaterThan(28_500);
    expect(need(fai).distanceM).toBeLessThan(30_200);
    const best = need(scoreFlight(track));
    expect(best.type).toBe('fai');
    expect(best.points).toBeCloseTo((best.distanceM / 1000) * XC_MULTIPLIER.fai, 1);
  });

  it('scores a long thin triangle as flat, not FAI', () => {
    const track = path([
      [0, 0],
      [20_000, 0],
      [10_000, 1_500],
      [0, 0],
    ]);
    const { fai, flat } = triangles(track);
    expect(need(flat).distanceM).toBeGreaterThan(38_000);
    // Any FAI triangle has to be a smaller one inside the track.
    expect(fai?.distanceM ?? 0).toBeLessThan(need(flat).distanceM * 0.6);
    expect(need(scoreFlight(track)).type).toBe('flat');
  });

  it('subtracts the closing gap and rejects open triangles', () => {
    const open = path([
      [0, 0],
      [10_000, 0],
      [5_000, 8_660],
      [2_500, 4_330], // finish halfway back: gap 5 km > 20% of 30 km? no, 5 km < 6 km
    ]);
    const { fai } = triangles(open);
    if (fai) {
      const gap = distance(need(fai.closing)[0], need(fai.closing)[1]);
      expect(gap).toBeGreaterThan(0);
      expect(fai.distanceM).toBeLessThan(30_000 - 4_000);
    }
    const far = path([
      [0, 0],
      [10_000, 0],
      [10_000, 10_000],
    ]);
    // Never closes: no triangle within 20 %.
    expect(triangles(far).fai).toBeNull();
  });

  it('scores a five-hour track quickly', () => {
    const corners: [number, number][] = [[0, 0]];
    for (let k = 1; k <= 18; k++) corners.push([(k % 3) * 8_000, Math.floor(k / 3) * 4_000]);
    const track = path(corners);
    expect(track.length).toBeGreaterThan(15_000);
    const started = performance.now();
    expect(scoreFlight(track)).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(3_000);
  });

  it('handles tiny tracks', () => {
    expect(scoreFlight([])).toBeNull();
    expect(
      triangles(
        path([
          [0, 0],
          [10, 0],
        ]),
      ).flat,
    ).toBeNull();
  });
});
