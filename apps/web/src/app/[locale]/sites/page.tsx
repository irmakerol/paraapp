import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSites } from '@/lib/sites';
import { Card, PageTitle } from '@/components/ui';
import { SitesMap } from '@/components/sites-map';
import { Conditions } from '@/components/weather-panel';
import { cachedTodayConditions } from '@/lib/weather';
import { sampleLabel } from '@/lib/sample';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sites' });
  return { title: t('title'), description: t('lead') };
}

/**
 * Height difference in a region: highest launch minus lowest landing (e.g. 605 m − 2 m = 603 m).
 * Null unless the region has both, with heights.
 */
function heightDifference(items: { kind: string; elevation_m: number | null }[]): number | null {
  const launches = items.filter((s) => s.kind !== 'landing' && s.elevation_m != null);
  const landings = items.filter((s) => s.kind !== 'launch' && s.elevation_m != null);
  if (!launches.length || !landings.length) return null;
  const top = Math.max(...launches.map((s) => s.elevation_m ?? 0));
  const bottom = Math.min(...landings.map((s) => s.elevation_m ?? 0));
  return top > bottom ? top - bottom : null;
}

export default async function SitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sites');
  const sites = await listSites();
  const today = await cachedTodayConditions(sites);
  const w = await getTranslations('weather');
  const regions = new Map<string, typeof sites>();
  for (const s of sites) {
    const key = s.region ?? t('otherRegion');
    regions.set(key, [...(regions.get(key) ?? []), s]);
  }

  return (
    <div className="space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      {sites.length ? (
        <SitesMap
          sites={sites.map(({ slug, name, lat, lng, kind, elevation_m }) => ({
            slug,
            name,
            lat,
            lng,
            kind,
            elevation_m,
          }))}
        />
      ) : (
        <Card>
          <p className="text-muted">{t('empty')}</p>
        </Card>
      )}
      {[...regions.entries()]
        .sort(([a], [b]) => a.localeCompare(b, locale))
        .map(([region, items]) => (
          <section key={region} className="space-y-3">
            <h2 className="flex flex-wrap items-baseline gap-x-3 text-xl font-bold">
              {region}
              {heightDifference(items) != null ? (
                <span className="text-base font-semibold text-muted">
                  {t('altitudeDiff', { m: heightDifference(items) ?? 0 })}
                </span>
              ) : null}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sites/${s.slug}`}
                    className="block h-full rounded-2xl border border-border bg-card p-4 hover:shadow-md"
                  >
                    <p className="font-bold">{sampleLabel(s.name, locale)}</p>
                    <p className="text-sm text-muted">
                      {t(`kinds.${s.kind}`)}
                      {s.elevation_m != null ? ` · ${s.elevation_m} m` : ''}
                      {` · ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}
                      {s.wind_directions.length
                        ? ` · ${s.wind_directions.map((d) => t(`wind.${d}`)).join(', ')}`
                        : ''}
                    </p>
                    {today.get(s.id) ? (
                      <div className="mt-2 rounded-lg bg-background px-2 py-1.5">
                        <p className="text-xs font-semibold text-muted">{w('today')}</p>
                        <Conditions day={today.get(s.id)!} />
                      </div>
                    ) : null}
                    {s.verified ? null : (
                      <p className="mt-1 text-xs font-semibold text-brand-red">{t('unverified')}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
