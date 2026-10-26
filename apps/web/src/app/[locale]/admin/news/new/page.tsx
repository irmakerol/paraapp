import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { NewsForm } from '../news-form';

export default async function NewNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'news');
  const t = await getTranslations('admin.newsForm');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">{t('new')}</h2>
      <NewsForm
        id={null}
        values={{
          title: '',
          slug: '',
          locale,
          summary: '',
          body_md: '',
          tags: '',
          cover_path: '',
          members_only: false,
          pinned: false,
          comments_enabled: true,
          notify_on_publish: false,
          status: 'draft',
          published_at: '',
        }}
      />
    </div>
  );
}
