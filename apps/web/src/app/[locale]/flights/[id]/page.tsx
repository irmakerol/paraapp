import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatDistance, formatDuration } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { displayNames } from '@/lib/people';
import { getFlight, siteLabel, visibleTrack } from '@/lib/flights';
import { flightFormOptions } from '@/lib/flight-options';
import { formatDate, formatDateTime } from '@/lib/format';
import { Button, buttonClass, Card } from '@/components/ui';
import { FlightViewer } from '@/components/flight-viewer';
import { ShareButtons } from '@/components/share-buttons';
import { ReportButton } from '@/components/report-button';
import { deleteFlight } from '../../logbook/actions';
import { FlightEditForm } from './edit-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const flight = await getFlight(id);
  if (!flight) return {};
  const t = await getTranslations({ locale, namespace: 'flight' });
  const supabase = await createClient();
  const names = await displayNames(supabase, [flight.user_id]);
  const title = t('metaTitle', {
    site: siteLabel(flight) ?? t('unknownSite'),
    date: formatDate(flight.started_at, locale),
  });
  const description = t('metaDescription', {
    pilot: names.get(flight.user_id) ?? t('pilot'),
    duration: formatDuration(flight.duration_s),
    distance: formatDistance(flight.distance_m, locale),
  });
  const isPublic = flight.visibility === 'public';
  return {
    title,
    description,
    // Only public flights are indexed or get a preview image.
    robots: isPublic ? undefined : { index: false },
    openGraph: isPublic
      ? { title, description, images: [`/api/flights/${flight.id}/image?locale=${locale}`] }
      : undefined,
  };
}

export default async function FlightPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('flight');
  const lt = await getTranslations('logbook');
  const flight = await getFlight(id);
  if (!flight) notFound();

  const viewer = await getViewer();
  const isOwner = viewer?.user.id === flight.user_id;
  const supabase = await createClient();
  const [names, { track, trimmed }] = await Promise.all([
    displayNames(supabase, [flight.user_id]),
    visibleTrack(flight, viewer?.user.id),
  ]);
  const pilot = names.get(flight.user_id);
  const site = siteLabel(flight);
  const wing = flight.wing
    ? [flight.wing.brand, flight.wing.model, flight.wing.size].filter(Boolean).join(' ')
    : null;

  const stats: [string, string | null][] = [
    [t('stats.duration'), formatDuration(flight.duration_s)],
    [
      t('stats.distance'),
      flight.distance_m != null ? formatDistance(flight.distance_m, locale) : null,
    ],
    [
      t('stats.straight'),
      flight.straight_m != null ? formatDistance(flight.straight_m, locale) : null,
    ],
    [
      t('stats.maxFromTakeoff'),
      flight.max_from_takeoff_m != null ? formatDistance(flight.max_from_takeoff_m, locale) : null,
    ],
    [t('stats.maxAlt'), flight.max_alt_m != null ? `${flight.max_alt_m} m` : null],
    [t('stats.takeoffAlt'), flight.takeoff_alt_m != null ? `${flight.takeoff_alt_m} m` : null],
    [t('stats.landingAlt'), flight.landing_alt_m != null ? `${flight.landing_alt_m} m` : null],
    [
      t('stats.maxClimb'),
      flight.max_climb_ms != null ? `${Number(flight.max_climb_ms).toFixed(1)} m/s` : null,
    ],
    [
      t('stats.maxSink'),
      flight.max_sink_ms != null ? `${Number(flight.max_sink_ms).toFixed(1)} m/s` : null,
    ],
    [t('stats.glider'), wing ?? flight.glider],
    [t('stats.landing'), flight.landing?.name ?? null],
  ];

  return (
    <div className="space-y-6">
      <Link
        href={isOwner ? '/logbook' : `/pilots/${flight.user_id}`}
        className="text-sm text-muted hover:underline"
      >
        ← {isOwner ? lt('title') : (pilot ?? t('pilot'))}
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold leading-tight">
          {site ?? t('unknownSite')}
          {flight.takeoff ? (
            <Link
              href={`/sites/${flight.takeoff.slug}`}
              className="ml-2 align-middle text-sm font-semibold text-primary hover:underline"
            >
              {t('sitePage')}
            </Link>
          ) : null}
        </h1>
        <p className="text-muted">
          {formatDateTime(flight.started_at, locale)}
          {pilot ? (
            <>
              {' · '}
              <Link href={`/pilots/${flight.user_id}`} className="hover:underline">
                {pilot}
              </Link>
            </>
          ) : null}
          {' · '}
          {lt(`visibility.${flight.visibility}`)}
          {flight.source === 'manual' ? ` · ${lt('manual')}` : ''}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {track ? (
            <FlightViewer track={track} trimmed={trimmed} />
          ) : flight.source !== 'manual' ? (
            <Card>
              <p className="text-muted">{t('noTrack')}</p>
            </Card>
          ) : null}
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {stats
              .filter(([, v]) => v !== null && v !== '')
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-border py-1.5"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium tabular-nums">{value}</dd>
                </div>
              ))}
          </dl>
          {flight.notes ? (
            <section>
              <h2 className="mb-2 text-xl font-bold">{lt('fields.notes')}</h2>
              <p className="whitespace-pre-line">{flight.notes}</p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold">{t('share')}</h2>
            {flight.visibility === 'public' ? (
              <ShareButtons
                path={`/${locale}/flights/${flight.id}`}
                title={site ?? t('unknownSite')}
                imagePath={`/api/flights/${flight.id}/image?locale=${locale}`}
              />
            ) : (
              <p className="text-sm text-muted">{t('shareNotPublic')}</p>
            )}
            {track ? (
              <>
                <h2 className="pt-2 font-bold">{t('download')}</h2>
                <p className="text-sm text-muted">
                  {trimmed ? t('downloadTrimmed') : t('downloadFull')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['igc', 'gpx', 'kml', 'csv'] as const).map((format) => (
                    <a
                      key={format}
                      href={`/api/flights/${flight.id}/export?format=${format}`}
                      className={buttonClass('secondary', 'uppercase')}
                      download
                    >
                      {format}
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </Card>
          {isOwner ? (
            <OwnerTools
              flightId={flight.id}
              locale={locale}
              userId={viewer!.user.id}
              isMinor={viewer!.profile.age_group !== 'adult'}
              flight={flight}
            />
          ) : viewer ? (
            <ReportButton targetType="user" targetId={flight.user_id} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

async function OwnerTools({
  flightId,
  locale,
  userId,
  isMinor,
  flight,
}: {
  flightId: string;
  locale: string;
  userId: string;
  isMinor: boolean;
  flight: NonNullable<Awaited<ReturnType<typeof getFlight>>>;
}) {
  const t = await getTranslations('flight');
  const common = await getTranslations('common');
  const options = await flightFormOptions(userId);
  return (
    <Card className="space-y-3">
      <details>
        <summary className="cursor-pointer font-bold">{common('edit')}</summary>
        <div className="mt-3">
          <FlightEditForm
            id={flightId}
            {...options}
            isMinor={isMinor}
            values={{
              takeoff_site_id: flight.takeoff_site_id ?? '',
              landing_site_id: flight.landing_site_id ?? '',
              site_name: flight.site_name ?? '',
              glider: flight.glider ?? '',
              wing_id: flight.wing_id ?? '',
              visibility: flight.visibility,
              notes: flight.notes ?? '',
            }}
          />
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm text-danger">{common('delete')}</summary>
        <form action={deleteFlight} className="mt-2 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={flightId} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger" className="w-full">
            {common('delete')}
          </Button>
        </form>
      </details>
    </Card>
  );
}
