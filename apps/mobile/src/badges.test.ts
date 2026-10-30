import { describe, expect, it } from 'vitest';
import { profileBadges } from './badges';

describe('profileBadges', () => {
  it('shows the training level instead of "student pilot"', () => {
    expect(
      profileBadges({ roles: ['student_pilot', 'member'], level: 'p2', trainingLevel: 'p3' }),
    ).toEqual([{ kind: 'training', level: 'p3' }]);
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

  it('shows no level badge without the pilot role, and guest member only alone', () => {
    expect(profileBadges({ roles: ['member'], level: 'p3' })).toEqual([
      { kind: 'role', role: 'member' },
    ]);
    expect(profileBadges({ roles: ['pilot', 'member'], level: 'instructor' })).toEqual([
      { kind: 'pilot', level: null },
      { kind: 'role', role: 'instructor' },
    ]);
    expect(profileBadges({ roles: [] })).toEqual([]);
  });
});
