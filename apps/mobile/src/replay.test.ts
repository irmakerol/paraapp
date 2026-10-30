import { describe, expect, it } from 'vitest';
import { altitudeBars, bearing, frameAt, indexAt } from './replay';

// About 1 m of latitude in degrees.
const M = 1 / 111_320;
const points = Array.from({ length: 21 }, (_, i) => ({
  t: i * 1000,
  lat: 36.5 + i * 10 * M,
  lng: 29.1,
  alt: 1000 + i * 2,
}));

describe('replay', () => {
  it('finds the fix at or before a time', () => {
    expect(indexAt(points, -5)).toBe(0);
    expect(indexAt(points, 2500)).toBe(2);
    expect(indexAt(points, 99_000)).toBe(20);
  });

  it('interpolates between fixes and gives heading, climb and speed', () => {
    const f = frameAt(points, 10_500);
    expect(f?.alt).toBeCloseTo(1021, 5);
    expect(f?.climb).toBeCloseTo(2, 5);
    expect(f?.speed).toBeCloseTo(36, 0);
    expect(f?.heading).toBeCloseTo(0, 0);
  });

  it('computes bearings clockwise from north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
    expect(bearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180, 5);
  });

  it('reduces the altitude profile to bars', () => {
    const bars = altitudeBars(points, 4);
    expect(bars).toHaveLength(4);
    expect(bars[3]).toBe(1040);
  });
});
