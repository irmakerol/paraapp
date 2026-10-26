import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { Alert, PageTitle } from '@/components/ui';
import { AdForm } from '../ad-form';

export default async function NewAdPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('market');
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t('newAd')}</PageTitle>
      {viewer.profile.age_group !== 'adult' ? (
        <Alert>{t('adultsOnly')}</Alert>
      ) : (
        <AdForm
          adId={null}
          userId={viewer.user.id}
          photos={[]}
          canPostAsClub={viewer.roles.includes('admin')}
          values={{
            title: '',
            category: 'wing',
            brand: '',
            model: '',
            size: '',
            weight_min: '',
            weight_max: '',
            year: '',
            hours: '',
            flights: '',
            certification: '',
            last_check_date: '',
            reserve_repack_date: '',
            condition: 'good',
            price: '',
            currency: 'TRY',
            city: viewer.profile.city ?? '',
            location_text: '',
            description: '',
            is_club: false,
          }}
        />
      )}
    </div>
  );
}
