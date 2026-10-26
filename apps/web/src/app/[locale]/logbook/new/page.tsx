import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { flightFormOptions } from '@/lib/flight-options';
import { PageTitle } from '@/components/ui';
import { ManualFlightForm } from './manual-form';

export default async function NewFlightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('logbook');
  const options = await flightFormOptions(viewer.user.id);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle lead={t('manualLead')}>{t('addManual')}</PageTitle>
      <ManualFlightForm {...options} isMinor={viewer.profile.age_group !== 'adult'} today={today} />
    </div>
  );
}
