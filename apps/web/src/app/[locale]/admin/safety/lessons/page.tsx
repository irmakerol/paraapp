import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { formatDate } from '@/lib/format';
import { buttonClass } from '@/components/ui';

export default async function AdminLessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'safety');
  const a = await getTranslations('admin.safetyAdmin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_lessons')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/safety" className={buttonClass('ghost')}>
          ← {a('back')}
        </Link>
        <Link href="/admin/safety/lessons/new" className={buttonClass('primary')}>
          {a('writeLesson')}
        </Link>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(data ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link
              href={`/admin/safety/lessons/${l.id}`}
              className="flex-1 font-semibold hover:underline"
            >
              {l.title}
            </Link>
            <span className="text-xs text-muted">
              {a(l.status === 'published' ? 'published' : 'draft')} ·{' '}
              {formatDate(l.created_at, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
