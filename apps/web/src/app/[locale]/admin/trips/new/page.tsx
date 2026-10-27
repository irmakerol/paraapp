import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { TripForm } from '../trip-form';
import { tripFormOptions, tripValues } from '../options';

export default async function NewTripPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'trips');
  const t = await getTranslations('admin.tripsAdmin');
  const { sites, people } = await tripFormOptions();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h2 className="text-xl font-bold">{t('new')}</h2>
      <TripForm id={null} values={tripValues(null)} sites={sites} people={people} />
    </div>
  );
}
