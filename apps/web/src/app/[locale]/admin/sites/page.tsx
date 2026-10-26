import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireStaff } from '@/lib/staff';
import { listSites } from '@/lib/sites';
import { buttonClass } from '@/components/ui';

export default async function AdminSitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'sites');
  const t = await getTranslations('admin.sitesAdmin');
  const sites = await getTranslations('sites');
  const all = await listSites();
  return (
    <div className="space-y-6">
      <Link href="/admin/sites/new" className={buttonClass('primary')}>
        {t('new')}
      </Link>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {all.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link href={`/admin/sites/${s.id}`} className="flex-1 font-semibold hover:underline">
              {s.name}
            </Link>
            <span className="text-xs text-muted">
              {sites(`kinds.${s.kind}`)} · {s.region ?? '—'} ·{' '}
              {s.verified ? t('verified') : sites('unverified')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
