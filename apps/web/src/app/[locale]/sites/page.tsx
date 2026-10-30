import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSites } from '@/lib/sites';
import { Card, PageTitle } from '@/components/ui';
import { SitesMap } from '@/components/sites-map';
import { ratingTone } from '@/components/weather-panel';
import { cachedTodayRatings } from '@/lib/weather';
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

export default async function SitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sites');
  const sites = await listSites();
  const ratings = await cachedTodayRatings(sites);
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
            <h2 className="text-xl font-bold">{region}</h2>
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
                    {ratings.get(s.id) ? (
                      <p className="mt-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${ratingTone[ratings.get(s.id)!]}`}
                        >
                          {w('today')}: {w(`ratings.${ratings.get(s.id)}`)}
                        </span>
                      </p>
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
