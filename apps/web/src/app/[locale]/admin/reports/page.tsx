import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { displayNames } from '@/lib/people';
import { formatDateTime } from '@/lib/format';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'reports');
  const t = await getTranslations('admin.reportsAdmin');
  const common = await getTranslations('common');
  const handled = (await searchParams).show === 'handled';
  const supabase = await createClient();
  let query = supabase
    .from('reports')
    .select('id, target_type, reason, reporter_id, status, created_at')
    .order('created_at', { ascending: !handled })
    .limit(200);
  query = handled ? query.neq('status', 'open') : query.eq('status', 'open');
  const { data: reports } = await query;
  const names = await displayNames(
    supabase,
    (reports ?? []).map((r) => r.reporter_id),
  );

  const tab = (label: string, show: string | null, active: boolean) => (
    <Link
      href={{ pathname: '/admin/reports', query: show ? { show } : {} }}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tab(t('open'), null, !handled)}
        {tab(t('handled'), 'handled', handled)}
      </div>
      {!reports?.length ? (
        <p className="text-muted">{common('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-2">{t('target')}</th>
                <th className="px-4 py-2">{t('reason')}</th>
                <th className="px-4 py-2">{t('reporter')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/admin/reports/${r.id}`} className="hover:underline">
                      {t(`targets.${r.target_type}`)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{common(`reasons.${r.reason}`)}</td>
                  <td className="px-4 py-2">
                    {(r.reporter_id && names.get(r.reporter_id)) || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">
                    {formatDateTime(r.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
