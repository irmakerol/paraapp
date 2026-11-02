import { describe, expect, it } from 'vitest';
import { profileBadges } from './badges';

describe('profileBadges', () => {
  it('shows the training level instead of "student pilot"', () => {
    expect(
      profileBadges({ roles: ['student_pilot', 'member'], level: 'p2', trainingLevel: 'p3' }),
    ).toEqual([
      { kind: 'pilot', level: 'p2' },
      { kind: 'training', level: 'p3' },
    ]);
    expect(profileBadges({ roles: ['student_pilot', 'member'], trainingLevel: 'p2' })).toEqual([
      { kind: 'training', level: 'p2' },
    ]);
  });

  it('puts the licence first, then training, then other roles', () => {
    expect(
      profileBadges({
        roles: ['admin', 'pilot', 'student_pilot', 'member'],
        level: 'p4',
        trainingLevel: 'p5',
        instructor: true,
      }),
    ).toEqual([
      { kind: 'pilot', level: 'p4' },
      { kind: 'training', level: 'p5' },
      { kind: 'role', role: 'instructor' },
      { kind: 'role', role: 'admin' },
    ]);
  });

  it('any pilot level replaces guest member with a pilot badge', () => {
    expect(profileBadges({ roles: ['member'], level: 'p3' })).toEqual([
      { kind: 'pilot', level: 'p3' },
    ]);
    expect(profileBadges({ roles: ['member'], level: 'student' })).toEqual([
      { kind: 'role', role: 'member' },
    ]);
    expect(profileBadges({ roles: ['pilot', 'member'], level: 'instructor' })).toEqual([
      { kind: 'pilot', level: null },
    ]);
    expect(profileBadges({ roles: [] })).toEqual([]);
  });
});
