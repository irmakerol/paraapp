import { describe, expect, it } from 'vitest';
import { compassPoint, dailyConditions, type HourRating } from './weather';

const hour = (time: string, wind: number, gust: number, dir: number, rain = 0): HourRating => ({
  time,
  rating: 'good',
  reasons: [],
  windKmh: wind,
  gustKmh: gust,
  directionDeg: dir,
  temperature: 20,
  precipitation: rain,
});

describe('compassPoint', () => {
  it('rounds to the nearest of 8 points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(200)).toBe('S');
    expect(compassPoint(250)).toBe('W');
    expect(compassPoint(-45)).toBe('NW');
  });
});

describe('dailyConditions', () => {
  it('summarises flying hours only', () => {
    const [day] = dailyConditions([
      hour('2026-10-31T06:00', 40, 60, 90, 5),
      hour('2026-10-31T10:00', 8, 15, 350),
      hour('2026-10-31T14:00', 16, 24, 10, 0.3),
      hour('2026-10-31T20:00', 50, 70, 180, 4),
    ]);
    expect(day).toMatchObject({
      date: '2026-10-31',
      windMinKmh: 8,
      windMaxKmh: 16,
      gustMaxKmh: 24,
      rainMm: 0.3,
    });
    // 350° and 10° average to about north, not 180°.
    expect(compassPoint(day?.directionDeg ?? 180)).toBe('N');
  });
});
