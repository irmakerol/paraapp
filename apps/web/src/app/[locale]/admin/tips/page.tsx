import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { displayNames } from '@/lib/people';
import { formatDate } from '@/lib/format';
import { buttonClass } from '@/components/ui';

export default async function AdminTipsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'tips');
  const t = await getTranslations('admin.tipsAdmin');
  const tips = await getTranslations('tips');
  const supabase = await createClient();
  const { data } = await supabase
    .from('tips')
    .select('id, title, status, category, author_id, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  const all = data ?? [];
  const names = await displayNames(
    supabase,
    all.map((x) => x.author_id),
  );
  const queue = all.filter((x) => x.status === 'pending_review');

  const list = (items: typeof all) => (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((tip) => (
        <li key={tip.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/admin/tips/${tip.id}`} className="flex-1 font-semibold hover:underline">
            {tip.title}
          </Link>
          <span className="text-xs text-muted">
            {tips(`categories.${tip.category}`)} · {tips(`status.${tip.status}`)} ·{' '}
            {(tip.author_id && names.get(tip.author_id)) || '—'} ·{' '}
            {formatDate(tip.created_at, locale)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-8">
      <Link href="/admin/tips/new" className={buttonClass('primary')}>
        {t('new')}
      </Link>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">
          {t('queue')} ({queue.length})
        </h2>
        {queue.length ? list(queue) : <p className="text-muted">—</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('all')}</h2>
        {list(all)}
      </section>
    </div>
  );
}
