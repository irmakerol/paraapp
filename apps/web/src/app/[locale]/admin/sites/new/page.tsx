import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { SiteForm } from '../site-form';

export default async function NewSitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'sites');
  const t = await getTranslations('admin.sitesAdmin');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">{t('new')}</h2>
      <SiteForm
        id={null}
        values={{
          name: '',
          slug: '',
          kind: 'launch',
          lat: '',
          lng: '',
          elevation_m: '',
          region: '',
          wind_directions: [],
          description: '',
          rules: '',
          verified: false,
        }}
      />
    </div>
  );
}
