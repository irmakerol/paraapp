import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { isoToIstanbulLocal } from '@/lib/format';
import { Button } from '@/components/ui';
import { NewsForm } from '../news-form';
import { deleteNews } from '../actions';

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'news');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.newsForm');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: n } = await supabase.from('news').select('*').eq('id', id).maybeSingle();
  if (!n) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{n.title}</h2>
        {n.status === 'published' ? (
          <Link href={`/news/${n.slug}`} className="text-sm underline">
            /news/{n.slug}
          </Link>
        ) : null}
      </div>
      <NewsForm
        id={n.id}
        values={{
          title: n.title,
          slug: n.slug,
          locale: n.locale,
          summary: n.summary ?? '',
          body_md: n.body_md,
          tags: n.tags.join(', '),
          cover_path: n.cover_path ?? '',
          members_only: n.members_only,
          pinned: n.pinned,
          comments_enabled: n.comments_enabled,
          notify_on_publish: n.notify_on_publish,
          status: n.status,
          published_at: isoToIstanbulLocal(n.published_at),
        }}
      />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteNews} className="mt-3 space-y-2">
          <p>{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={n.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
