import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { INCIDENT_SEVERITIES } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { formatDate } from '@/lib/format';
import { Alert, buttonClass, Card, PageTitle } from '@/components/ui';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'safety' });
  return { title: t('title'), description: t('lead') };
}

export default async function SafetyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { locale } = await params;
  const { sent } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('safety');
  const supabase = await createClient();
  const viewer = await getViewer();
  const [{ data: lessons }, { data: stats }, mine] = await Promise.all([
    supabase
      .from('safety_lessons')
      .select('slug, title, summary, category, severity, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30),
    supabase.rpc('incident_stats'),
    viewer
      ? supabase
          .from('incident_reports')
          .select('id, occurred_on, category, status, anonymity, created_at')
          .eq('reporter_id', viewer.user.id)
          .order('created_at', { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Totals per year and severity for the small stats table.
  const years = new Map<number, Record<string, number>>();
  for (const row of stats ?? []) {
    const y = years.get(row.year) ?? {};
    y[row.severity] = (y[row.severity] ?? 0) + Number(row.reports);
    years.set(row.year, y);
  }

  return (
    <div className="space-y-8">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      {sent ? <Alert tone="success">{t('sent')}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/safety/report" className={buttonClass('primary')}>
          {t('reportButton')}
        </Link>
        <Link href="/sos" className={buttonClass('danger')}>
          {t('sosButton')}
        </Link>
      </div>
      <p className="text-sm text-muted">{t('justCulture')}</p>

      {mine.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">{t('myReports')}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {mine.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span>
                  {formatDate(r.occurred_on, locale)} · {t(`categories.${r.category}`)}
                </span>
                <span className="text-sm text-muted">
                  {t(`anonymity.${r.anonymity}`)} · {t(`statuses.${r.status}`)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t('anonymousNotListed')}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('lessons')}</h2>
        {lessons?.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {lessons.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/safety/lessons/${l.slug}`}
                  className="block h-full rounded-2xl border border-border bg-card p-5 hover:shadow-md"
                >
                  <p className="text-xs font-semibold uppercase text-muted">
                    {t(`categories.${l.category}`)} · {t(`severities.${l.severity}`)}
                  </p>
                  <p className="mt-1 text-lg font-bold">{l.title}</p>
                  {l.summary ? <p className="mt-1 text-sm text-muted">{l.summary}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">{t('noLessons')}</p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('stats')}</h2>
        {years.size ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">{t('stats')}</caption>
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="py-2">
                    {t('year')}
                  </th>
                  {INCIDENT_SEVERITIES.map((s) => (
                    <th key={s} scope="col" className="py-2 text-right">
                      {t(`severities.${s}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...years.entries()].map(([year, counts]) => (
                  <tr key={year} className="border-t border-border">
                    <th scope="row" className="py-2 font-semibold">
                      {year}
                    </th>
                    {INCIDENT_SEVERITIES.map((s) => (
                      <td key={s} className="py-2 text-right tabular-nums">
                        {counts[s] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t('noStats')}</p>
        )}
        <p className="text-xs text-muted">{t('statsNote')}</p>
      </section>
    </div>
  );
}
