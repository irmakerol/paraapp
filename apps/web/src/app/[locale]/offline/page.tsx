import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonClass, PageTitle } from '@/components/ui';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Shown by the service worker when there is no connection and the page was not saved. */
export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('offline');
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <Link href="/sos" className={buttonClass('primary')}>
        {t('sos')}
      </Link>
      <p className="text-sm text-muted">{t('saved')}</p>
    </div>
  );
}
