import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { listFlights, pilotStats } from '@/lib/flights';
import { buttonClass, Card, PageTitle } from '@/components/ui';
import { FlightList } from '@/components/flight-list';
import { StatsGrid } from '@/components/stats-grid';

export const metadata: Metadata = { robots: { index: false } };

export default async function LogbookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('logbook');
  const [flights, stats] = await Promise.all([
    listFlights(viewer.user.id),
    pilotStats(viewer.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Link href="/logbook/import" className={buttonClass('primary')}>
          {t('importButton')}
        </Link>
        <Link href="/logbook/new" className={buttonClass('secondary')}>
          {t('addManual')}
        </Link>
        <Link href="/logbook/equipment" className={buttonClass('secondary')}>
          {t('equipmentButton')}
        </Link>
        <Link href={`/pilots/${viewer.user.id}`} className={buttonClass('ghost')}>
          {t('myPilotPage')}
        </Link>
        {flights.length ? (
          <a href="/api/logbook/export" className={buttonClass('ghost')} download>
            {t('exportCsv')}
          </a>
        ) : null}
      </div>
      <StatsGrid stats={stats} locale={locale} />
      {flights.length ? (
        <FlightList flights={flights} showVisibility />
      ) : (
        <Card>
          <p className="text-muted">{t('empty')}</p>
        </Card>
      )}
    </div>
  );
}
