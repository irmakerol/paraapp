import { getTranslations } from 'next-intl/server';
import { MEMBER_LEVEL_ROLES } from '@paraapp/core';

const STAFF = new Set(['super_admin', 'admin', 'moderator', 'safety_officer', 'trip_organiser']);

/**
 * Every role a person holds as a badge, plus their pilot level ("Pilot P5"). "Guest member" is
 * left out when they also hold a stronger membership role (pilot, student pilot, instructor…).
 */
export async function RoleBadges({
  roles,
  level,
  className = '',
}: {
  roles: readonly string[];
  level?: string | null;
  className?: string;
}) {
  const t = await getTranslations('roles');
  const p = await getTranslations('pilots');
  const levels = await getTranslations('account.profile');
  const hasStronger = roles.some(
    (r) => r !== 'member' && (MEMBER_LEVEL_ROLES as readonly string[]).includes(r),
  );
  const shown = roles.filter((r) => r !== 'member' || !hasStronger);
  const levelLabel = level
    ? /^p\d$/.test(level)
      ? p('levelBadge.pilot', { level: levels(`levels.${level}` as 'levels.p2') })
      : /^t\d$/.test(level)
        ? p('levelBadge.tandem', { level: levels(`levels.${level}` as 'levels.p2') })
        : levels(`levels.${level}` as 'levels.p2')
    : null;
  if (!shown.length && !levelLabel) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {levelLabel ? (
        <li className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-bold text-white">
          {levelLabel}
        </li>
      ) : null}
      {shown.map((r) => (
        <li
          key={r}
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            STAFF.has(r)
              ? 'bg-brand-navy text-white'
              : 'border border-brand-navy/30 bg-brand-navy/10 text-foreground'
          }`}
        >
          {t.has(r) ? t(r) : r}
        </li>
      ))}
    </ul>
  );
}
