/**
 * The badges on a person's profile (Irmak, 2026-10-30): only what they hold, pilot first
 * ("Pilot (P4)"), then what they train for ("Training for P5"), then their other roles.
 * "Guest member" only shows when nothing else does. Copy of packages/core/src/badges.ts (the app is not in the pnpm workspace); keep both in sync.
 */
export type Badge =
  | { kind: 'pilot'; level: string | null }
  | { kind: 'training'; level: string | null }
  | { kind: 'role'; role: string };

export function profileBadges({
  roles,
  level = null,
  trainingLevel = null,
  instructor = false,
}: {
  roles: readonly string[];
  level?: string | null;
  trainingLevel?: string | null;
  /** The instructor rating, set by admins. */
  instructor?: boolean;
}): Badge[] {
  const badges: Badge[] = [];
  // The legacy "instructor" level and "student" are no licence level.
  const licence = level && level !== 'instructor' && level !== 'student' ? level : null;
  // Any pilot level counts as a pilot, even before an admin grants the role (Irmak, 2026-10-30).
  if (roles.includes('pilot') || licence) badges.push({ kind: 'pilot', level: licence });
  if (roles.includes('student_pilot')) badges.push({ kind: 'training', level: trainingLevel });
  const others = roles.filter((r) => r !== 'pilot' && r !== 'student_pilot' && r !== 'member');
  if (instructor && !others.includes('instructor')) others.unshift('instructor');
  for (const role of others) badges.push({ kind: 'role', role });
  if (!badges.length && roles.includes('member')) badges.push({ kind: 'role', role: 'member' });
  return badges;
}
