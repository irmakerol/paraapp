import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getViewer } from '@/lib/session';
import { activeFlightStart } from '@/lib/active-flight';
import { formatDateTime } from '@/lib/format';
import { Card, PageTitle, buttonClass } from '@/components/ui';
import { OpenAppButton } from './open-app';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'fly' });
  return { title: t('title'), description: t('lead') };
}

/** "Fly now": flights are recorded by the phone app; this page opens it or explains how. */
export default async function FlyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('fly');
  const viewer = await getViewer();
  const since = viewer ? await activeFlightStart(viewer.user.id) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      {since ? (
        <Card className="border-2 border-sos">
          <p className="text-lg font-bold text-sos">{t('flyingNow')}</p>
          <p className="mt-1">{t('flyingSince', { time: formatDateTime(since, locale) })}</p>
          <p className="mt-1 text-sm text-muted">{t('flyingHelp')}</p>
        </Card>
      ) : null}
      <OpenAppButton />
      <Card className="space-y-2">
        <h2 className="text-lg font-bold">{t('noAppTitle')}</h2>
        <p>{t('noAppBody')}</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('afterTitle')}</h2>
        <p>{t('afterBody')}</p>
        <Link href="/logbook/import" className={buttonClass('secondary')}>
          {t('import')}
        </Link>
      </Card>
    </div>
  );
}
