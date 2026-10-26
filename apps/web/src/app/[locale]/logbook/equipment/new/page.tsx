import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { PageTitle } from '@/components/ui';
import { EquipmentForm } from '../equipment-form';

export default async function NewEquipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireActiveViewer(locale);
  const t = await getTranslations('equipment');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t('add')}</PageTitle>
      <EquipmentForm
        id={null}
        today={today}
        values={{
          kind: 'wing',
          brand: '',
          model: '',
          size: '',
          certification: '',
          purchased_on: '',
          last_check_on: '',
          check_interval_months: '',
          last_repack_on: '',
          repack_interval_months: '',
          notes: '',
        }}
      />
    </div>
  );
}
