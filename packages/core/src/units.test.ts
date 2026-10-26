import { describe, expect, it } from 'vitest';
import { convertAltitude, convertDistance, convertSpeed } from './units';

describe('units', () => {
  it('converts speed', () => {
    expect(convertSpeed(10, 'kmh')).toBeCloseTo(36);
    expect(convertSpeed(10, 'ms')).toBe(10);
    expect(convertSpeed(10, 'kt')).toBeCloseTo(19.44, 2);
  });
  it('converts altitude', () => {
    expect(convertAltitude(1000, 'metric')).toBe(1000);
    expect(convertAltitude(1000, 'imperial')).toBeCloseTo(3280.84, 1);
  });
  it('converts distance', () => {
    expect(convertDistance(1609.344, 'imperial')).toBeCloseTo(1);
    expect(convertDistance(2500, 'metric')).toBe(2.5);
  });
});
