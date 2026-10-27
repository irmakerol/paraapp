/** Must match the `app_role` enum in SQL. "guest" is anyone not signed in and has no row. */
export const ROLES = [
  'pilot',
  'member',
  'instructor',
  'moderator',
  'safety_officer',
  'trip_organiser',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that count as "members" for members-only content and field privacy. */
export const MEMBER_LEVEL_ROLES: readonly Role[] = [
  'member',
  'instructor',
  'moderator',
  'safety_officer',
  'trip_organiser',
  'admin',
];

export function isMemberLevel(roles: readonly Role[]): boolean {
  return roles.some((r) => MEMBER_LEVEL_ROLES.includes(r));
}
