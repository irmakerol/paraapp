import { describe, expect, it } from 'vitest';
import { adSchema, needsSafetyNotice, parseAdFilters } from './market';

const valid = {
  title: 'Ozone Rush 6 ML',
  category: 'wing',
  condition: 'good',
  price: '1800',
  currency: 'EUR',
  description: '',
  weight_min: '85',
  weight_max: '105',
  year: '',
  last_check_date: '2026-04-01',
};

describe('adSchema', () => {
  it('coerces numbers and empty strings', () => {
    const ad = adSchema.parse(valid);
    expect(ad.price).toBe(1800);
    expect(ad.year).toBeNull();
    expect(ad.weight_min).toBe(85);
  });
  it('checks the weight range', () => {
    expect(adSchema.safeParse({ ...valid, weight_min: '110' }).success).toBe(false);
  });
});

describe('needsSafetyNotice', () => {
  it('applies to wings and reserves only', () => {
    expect(needsSafetyNotice('wing')).toBe(true);
    expect(needsSafetyNotice('reserve')).toBe(true);
    expect(needsSafetyNotice('helmet')).toBe(false);
  });
});

describe('parseAdFilters', () => {
  it('keeps valid filters and drops invalid ones', () => {
    expect(
      parseAdFilters({ category: 'wing', min: '100', max: 'abc', currency: 'GBP', q: 'ozone' }),
    ).toEqual({
      category: 'wing',
      min: 100,
      q: 'ozone',
    });
  });
});
