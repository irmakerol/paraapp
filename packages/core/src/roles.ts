/** Must match the `app_role` enum in SQL. "guest" is anyone not signed in and has no row. */
export const ROLES = [
  'student_pilot',
  'pilot',
  'member',
  'instructor',
  'guide',
  'moderator',
  'safety_officer',
  'trip_organiser',
  'admin',
  'super_admin',
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Roles that count as "members" for members-only content and field privacy. Every new account
 * gets "member" (shown as guest member), so in practice this is everyone signed in.
 */
export const MEMBER_LEVEL_ROLES: readonly Role[] = [
  'member',
  'student_pilot',
  'pilot',
  'instructor',
  'guide',
  'moderator',
  'safety_officer',
  'trip_organiser',
  'admin',
  'super_admin',
];

/** Only a super admin may grant or revoke these (RLS enforces the same). */
export const SUPER_ADMIN_ONLY_ROLES: readonly Role[] = ['admin', 'super_admin'];

export function isMemberLevel(roles: readonly Role[]): boolean {
  return roles.some((r) => MEMBER_LEVEL_ROLES.includes(r));
}
