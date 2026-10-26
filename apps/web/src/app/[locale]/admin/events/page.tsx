import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { formatDateTime } from '@/lib/format';
import { buttonClass } from '@/components/ui';

export default async function AdminEventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'events');
  const t = await getTranslations('admin.eventsAdmin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('id, title, status, starts_at')
    .order('starts_at', { ascending: false })
    .limit(200);
  return (
    <div className="space-y-6">
      <Link href="/admin/events/new" className={buttonClass('primary')}>
        {t('new')}
      </Link>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(data ?? []).map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link href={`/admin/events/${e.id}`} className="flex-1 font-semibold hover:underline">
              {e.title}
            </Link>
            <span className="text-xs text-muted">
              {t(`statuses.${e.status}`)} · {formatDateTime(e.starts_at, locale)}
            </span>
          </li>
        ))}
        {!data?.length && <li className="px-4 py-3 text-sm text-muted">{t('empty')}</li>}
      </ul>
    </div>
  );
}
