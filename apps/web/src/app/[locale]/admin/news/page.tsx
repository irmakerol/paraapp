import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { currentTime, formatDateTime } from '@/lib/format';
import { buttonClass } from '@/components/ui';

export default async function AdminNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'news');
  const t = await getTranslations('admin.newsForm');
  const supabase = await createClient();
  const { data: items } = await supabase
    .from('news')
    .select('id, title, status, published_at, pinned, members_only')
    .order('created_at', { ascending: false })
    .limit(200);
  const now = currentTime();

  return (
    <div className="space-y-4">
      <Link href="/admin/news/new" className={buttonClass('primary')}>
        {t('new')}
      </Link>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(items ?? []).map((n) => {
          const scheduled =
            n.status === 'published' && n.published_at && new Date(n.published_at).getTime() > now;
          return (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/admin/news/${n.id}`} className="flex-1 font-semibold hover:underline">
                {n.title}
              </Link>
              <span className="text-xs text-muted">
                {scheduled ? t('scheduled') : t(n.status)}
                {n.published_at ? ` · ${formatDateTime(n.published_at, locale)}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
