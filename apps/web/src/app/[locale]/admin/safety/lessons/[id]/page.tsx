import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { Button } from '@/components/ui';
import { LessonForm } from '../lesson-form';
import { deleteLesson } from '../../actions';

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'safety');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const a = await getTranslations('admin.safetyAdmin');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from('safety_lessons')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!lesson) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{a('editLesson')}</h2>
        <Link href={`/safety/lessons/${lesson.slug}`} className="text-sm underline">
          /safety/lessons/{lesson.slug}
        </Link>
      </div>
      <LessonForm
        id={lesson.id}
        values={{
          title: lesson.title,
          locale: lesson.locale,
          summary: lesson.summary ?? '',
          body_md: lesson.body_md,
          category: lesson.category,
          severity: lesson.severity,
          status: lesson.status,
        }}
      />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteLesson} className="mt-3">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
