import { getTranslations } from 'next-intl/server';
import { formatDistance, formatDuration } from '@paraapp/core';

export interface Stats {
  flights: number;
  total_s: number;
  longest_s: number | null;
  max_distance_m: number | null;
  max_straight_m: number | null;
  max_alt_m: number | null;
  max_climb_ms: number | null;
  sites: number;
}

export function statTiles(
  stats: Stats | null,
  t: (key: string) => string,
  locale: string,
): { key: string; label: string; value: string }[] {
  const s = stats;
  return [
    { key: 'flights', label: t('stats.flights'), value: String(s?.flights ?? 0) },
    { key: 'hours', label: t('stats.hours'), value: formatDuration(s?.total_s ?? 0) },
    {
      key: 'longest',
      label: t('stats.longest'),
      value: s?.longest_s ? formatDuration(s.longest_s) : '–',
    },
    {
      key: 'distance',
      label: t('stats.maxDistance'),
      value: formatDistance(s?.max_distance_m, locale),
    },
    {
      key: 'straight',
      label: t('stats.maxStraight'),
      value: formatDistance(s?.max_straight_m, locale),
    },
    {
      key: 'alt',
      label: t('stats.maxAlt'),
      value: s?.max_alt_m != null ? `${s.max_alt_m} m` : '–',
    },
    {
      key: 'climb',
      label: t('stats.maxClimb'),
      value: s?.max_climb_ms != null ? `${Number(s.max_climb_ms).toFixed(1)} m/s` : '–',
    },
    { key: 'sites', label: t('stats.sites'), value: String(s?.sites ?? 0) },
  ];
}

export async function StatsGrid({ stats, locale }: { stats: Stats | null; locale: string }) {
  const t = await getTranslations('logbook');
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statTiles(stats, t, locale).map((tile) => (
        <div key={tile.key} className="rounded-2xl border border-border bg-card p-4">
          <dt className="text-xs text-muted">{tile.label}</dt>
          <dd className="text-xl font-extrabold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
