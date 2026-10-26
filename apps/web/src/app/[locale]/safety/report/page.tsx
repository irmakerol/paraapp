import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { listSites } from '@/lib/sites';
import { Alert, PageTitle } from '@/components/ui';
import { IncidentForm } from './report-form';

export const metadata: Metadata = { robots: { index: false } };

export default async function ReportIncidentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireActiveViewer(locale);
  const t = await getTranslations('safety');
  const sites = await listSites();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/safety" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      <PageTitle lead={t('report.lead')}>{t('report.title')}</PageTitle>
      <Alert tone="error">
        {t('report.emergency')}{' '}
        <Link href="/sos" className="font-bold underline">
          SOS
        </Link>
      </Alert>
      <IncidentForm sites={sites.map(({ id, name }) => ({ id, name }))} today={today} />
    </div>
  );
}
