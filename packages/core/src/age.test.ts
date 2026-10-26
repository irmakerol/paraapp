import { describe, expect, it } from 'vitest';
import { ageGroup, ageOn, parseIsoDate } from './age';

describe('parseIsoDate', () => {
  it('accepts valid dates', () => {
    expect(parseIsoDate('2000-02-29')).toEqual({ y: 2000, m: 2, d: 29 });
  });
  it('rejects impossible or malformed dates', () => {
    expect(parseIsoDate('2001-02-29')).toBeNull();
    expect(parseIsoDate('2001-13-01')).toBeNull();
    expect(parseIsoDate('01-01-2001')).toBeNull();
  });
});

describe('ageOn', () => {
  it('counts full years only', () => {
    expect(ageOn('2000-06-15', '2026-06-14')).toBe(25);
    expect(ageOn('2000-06-15', '2026-06-15')).toBe(26);
  });
  it('throws on invalid input', () => {
    expect(() => ageOn('nope', '2026-01-01')).toThrow();
  });
});

describe('ageGroup', () => {
  it('blocks under 14', () => {
    expect(ageGroup('2012-10-27', '2026-10-26')).toBe('too_young');
  });
  it('treats 14 to 17 as minor', () => {
    expect(ageGroup('2012-10-26', '2026-10-26')).toBe('minor');
    expect(ageGroup('2008-10-27', '2026-10-26')).toBe('minor');
  });
  it('treats 18 and over as adult', () => {
    expect(ageGroup('2008-10-26', '2026-10-26')).toBe('adult');
  });
});
