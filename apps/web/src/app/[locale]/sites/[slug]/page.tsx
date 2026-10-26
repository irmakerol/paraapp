import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { getSite } from '@/lib/sites';
import { FLIGHT_LIST_COLUMNS } from '@/lib/flights';
import { displayNames } from '@/lib/people';
import { formatDate } from '@/lib/format';
import { formatDistance, formatDuration } from '@paraapp/core';
import { Alert, buttonClass, Card } from '@/components/ui';
import { Markdown } from '@/components/markdown';
import { SitesMap } from '@/components/sites-map';
import { WindRose } from '@/components/wind-rose';
import { WeatherPanel } from '@/components/weather-panel';
import { siteForecast } from '@/lib/weather';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const site = await getSite(slug);
  if (!site) return {};
  const t = await getTranslations({ locale, namespace: 'sites' });
  return {
    title: site.name,
    description: site.description.slice(0, 160) || t('metaDescription', { name: site.name }),
  };
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sites');
  const site = await getSite(slug);
  if (!site) notFound();

  const supabase = await createClient();
  const viewer = await getViewer();
  // Recent flights the viewer may see (RLS): public ones for guests.
  const { data: flights } = await supabase
    .from('flights')
    .select(`${FLIGHT_LIST_COLUMNS}, user_id`)
    .eq('takeoff_site_id', site.id)
    .order('started_at', { ascending: false })
    .limit(20);
  const forecast = await siteForecast(site);
  const names = await displayNames(
    supabase,
    (flights ?? []).map((f) => f.user_id),
  );
  const short = (d: string) => t(`windShort.${d}`);

  return (
    <div className="space-y-6">
      <Link href="/sites" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">{site.name}</h1>
        <p className="text-muted">
          {[
            t(`kinds.${site.kind}`),
            site.region,
            site.elevation_m != null ? `${site.elevation_m} m` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>
      {site.verified ? null : <Alert tone="error">{t('unverifiedNotice')}</Alert>}
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <SitesMap sites={[{ slug: site.slug, name: site.name, lat: site.lat, lng: site.lng }]} />
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('weather')}</h2>
            <WeatherPanel forecast={forecast} locale={locale} />
          </section>
          {site.description ? <Markdown ugc>{site.description}</Markdown> : null}
          {site.rules ? (
            <section>
              <h2 className="mb-2 text-xl font-bold">{t('rules')}</h2>
              <Markdown ugc>{site.rules}</Markdown>
            </section>
          ) : null}
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('recentFlights')}</h2>
            {flights?.length ? (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {flights.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/flights/${f.id}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-background"
                    >
                      <span className="font-semibold">{names.get(f.user_id) ?? t('pilot')}</span>
                      <span className="text-sm text-muted tabular-nums">
                        {formatDate(f.started_at, locale)} · {formatDuration(f.duration_s)} ·{' '}
                        {formatDistance(f.distance_m, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{t('noFlights')}</p>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold">{t('windDirections')}</h2>
            {site.wind_directions.length ? (
              <>
                <WindRose
                  directions={site.wind_directions}
                  label={site.wind_directions.map((d) => t(`wind.${d}`)).join(', ')}
                  short={short}
                />
                <p className="text-sm">
                  {site.wind_directions.map((d) => t(`wind.${d}`)).join(', ')}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">{t('windUnknown')}</p>
            )}
            <p className="text-sm text-muted tabular-nums">
              {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lng}#map=14/${site.lat}/${site.lng}`}
              className="text-sm text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('openInOsm')}
            </a>
          </Card>
          <Alert>{t('safety')}</Alert>
          {viewer && canUse(viewer, 'sites') ? (
            <Link href={`/admin/sites/${site.id}`} className={buttonClass('secondary', 'w-full')}>
              {t('editSite')}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
