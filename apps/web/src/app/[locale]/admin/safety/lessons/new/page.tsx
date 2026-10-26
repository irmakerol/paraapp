import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { LessonForm } from '../lesson-form';

export default async function NewLessonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'safety');
  const a = await getTranslations('admin.safetyAdmin');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">{a('writeLesson')}</h2>
      <LessonForm
        id={null}
        values={{
          title: '',
          locale,
          summary: '',
          body_md: '',
          category: 'other',
          severity: 'near_miss',
          status: 'draft',
        }}
      />
    </div>
  );
}
