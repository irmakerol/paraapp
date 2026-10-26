import { getTranslations, setRequestLocale } from 'next-intl/server';
import { INCIDENT_STATUSES } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { formatDate } from '@/lib/format';
import { buttonClass } from '@/components/ui';

export default async function AdminSafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'safety');
  const t = await getTranslations('safety');
  const a = await getTranslations('admin.safetyAdmin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('incident_reports')
    .select(
      'id, occurred_on, category, severity, status, anonymity, injured, site_name, created_at, sites:site_id(name)',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  const all = data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/safety/lessons" className={buttonClass('secondary')}>
          {a('lessons')}
        </Link>
      </div>
      <p className="text-sm text-muted">{a('auditNote')}</p>
      {INCIDENT_STATUSES.map((status) => {
        const items = all.filter((r) => r.status === status);
        return (
          <section key={status} className="space-y-3">
            <h2 className="text-xl font-bold">
              {t(`statuses.${status}`)} ({items.length})
            </h2>
            {items.length ? (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {items.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/safety/${r.id}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-background"
                    >
                      <span className="font-semibold">
                        {t(`categories.${r.category}`)} · {t(`severities.${r.severity}`)}
                        {r.injured ? ` · ${a('injured')}` : ''}
                      </span>
                      <span className="text-sm text-muted">
                        {formatDate(r.occurred_on, locale)} · {r.sites?.name ?? r.site_name ?? '—'}{' '}
                        · {t(`anonymity.${r.anonymity}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">—</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
