import { getTranslations } from 'next-intl/server';
import { profileBadges } from '@paraapp/core';

const STAFF = new Set(['super_admin', 'admin', 'moderator', 'safety_officer', 'trip_organiser']);

/**
 * Only the badges a person holds (`profileBadges` in core): "Pilot (P4)" first, then
 * "Training for P5", then their other roles.
 */
export async function RoleBadges({
  roles,
  level,
  trainingLevel,
  instructor = false,
  className = '',
}: {
  roles: readonly string[];
  level?: string | null;
  trainingLevel?: string | null;
  /** Ticked "I am an instructor" on their profile. */
  instructor?: boolean;
  className?: string;
}) {
  const t = await getTranslations('roles');
  const b = await getTranslations('pilots.badge');
  const levels = await getTranslations('account.profile.levels');
  const levelName = (l: string) => (levels.has(l) ? levels(l as 'p2') : l.toUpperCase());
  const badges = profileBadges({ roles, level, trainingLevel, instructor });
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((badge) =>
        badge.kind === 'role' ? (
          <li
            key={badge.role}
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              STAFF.has(badge.role)
                ? 'bg-brand-navy text-white'
                : 'border border-brand-navy/30 bg-brand-navy/10 text-foreground'
            }`}
          >
            {t.has(badge.role) ? t(badge.role) : badge.role}
          </li>
        ) : (
          <li
            key={badge.kind}
            className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-bold text-white"
          >
            {badge.kind === 'pilot'
              ? badge.level
                ? b('pilot', { level: levelName(badge.level) })
                : b('pilotNoLevel')
              : badge.level
                ? b('training', { level: levelName(badge.level) })
                : b('trainingNoLevel')}
          </li>
        ),
      )}
    </ul>
  );
}
