import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { AdminTipForm } from '../admin-tip-form';

export default async function NewTipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'tips');
  const t = await getTranslations('admin.tipsAdmin');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">{t('new')}</h2>
      <AdminTipForm
        id={null}
        status="published"
        reviewNote=""
        values={{
          title: '',
          locale,
          summary: '',
          body_md: '',
          category: 'beginner_faq',
          difficulty: 'beginner',
          video_url: '',
        }}
      />
    </div>
  );
}
