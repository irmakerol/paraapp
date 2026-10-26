import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { PageTitle } from '@/components/ui';
import { Importer } from './importer';

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireActiveViewer(locale);
  const t = await getTranslations('logbook');
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle lead={t('import.lead')}>{t('import.title')}</PageTitle>
      <Importer />
    </div>
  );
}
