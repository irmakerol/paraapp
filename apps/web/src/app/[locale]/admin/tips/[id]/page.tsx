import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { displayNames } from '@/lib/people';
import { Button } from '@/components/ui';
import { AdminTipForm } from '../admin-tip-form';
import { deleteTip } from '../actions';

export default async function EditTipPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'tips');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.tipsAdmin');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: tip } = await supabase.from('tips').select('*').eq('id', id).maybeSingle();
  if (!tip) notFound();
  const names = await displayNames(supabase, [tip.author_id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('edit')}</h2>
        <p className="text-sm text-muted">
          {tip.author_id ? common('by', { name: names.get(tip.author_id) ?? '—' }) : null} ·{' '}
          <Link href={`/tips/${tip.slug}`} className="underline">
            /tips/{tip.slug}
          </Link>
        </p>
      </div>
      <AdminTipForm
        id={tip.id}
        status={tip.status}
        reviewNote={tip.review_note ?? ''}
        values={{
          title: tip.title,
          locale: tip.locale,
          summary: tip.summary ?? '',
          body_md: tip.body_md,
          category: tip.category,
          difficulty: tip.difficulty,
          video_url: tip.video_url ?? '',
        }}
      />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteTip} className="mt-3">
          <input type="hidden" name="id" value={tip.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
