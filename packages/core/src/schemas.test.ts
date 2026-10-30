import { describe, expect, it } from 'vitest';
import { defaultFieldPrivacy } from './privacy';
import { profileSchema, signUpSchema, trainingLevelOptions, yearsFlying } from './schemas';

describe('signUpSchema', () => {
  it('normalises email and enforces password length', () => {
    const ok = signUpSchema.safeParse({ email: ' Pilot@Example.com ', password: 'longenough1' });
    expect(ok.success && ok.data.email).toBe('pilot@example.com');
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('turns empty optional strings into null', () => {
    const parsed = profileSchema.parse({
      display_name: 'Ayşe',
      bio: '',
      flying_since: '2019',
      total_flight_hours: '120.34',
      field_privacy: defaultFieldPrivacy('adult'),
    });
    expect(parsed.bio).toBeNull();
    expect(parsed.flying_since).toBe(2019);
    expect(parsed.total_flight_hours).toBe(120.3);
  });
  it('rejects unknown visibility values', () => {
    const result = profileSchema.safeParse({
      display_name: 'Ayşe',
      field_privacy: { ...defaultFieldPrivacy('adult'), bio: 'everyone' },
    });
    expect(result.success).toBe(false);
  });
});

describe('yearsFlying', () => {
  it('counts from the year a pilot started', () => {
    const now = new Date('2026-10-27');
    expect(yearsFlying({ flying_since: 2019 }, now)).toBe(7);
    expect(yearsFlying({ flying_since: null, years_flying: 4 }, now)).toBe(4);
    expect(yearsFlying({}, now)).toBeNull();
  });
});

describe('trainingLevelOptions', () => {
  it('offers only levels above the current one', () => {
    expect(trainingLevelOptions('p3')).toEqual(['p4', 'p5', 't1', 't2', 't3']);
    expect(trainingLevelOptions('p5')).toEqual(['t1', 't2', 't3']);
    expect(trainingLevelOptions('t3')).toEqual([]);
  });
  it('offers everything without a level, and places legacy levels on the same ladder', () => {
    expect(trainingLevelOptions(null)).toEqual(['p2', 'p3', 'p4', 'p5', 't1', 't2', 't3']);
    expect(trainingLevelOptions('student')).toHaveLength(7);
    expect(trainingLevelOptions('tandem')).toEqual(['t2', 't3']);
  });
});
