import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActiveViewer } from '@/lib/session';
import { listSites } from '@/lib/sites';
import { displayNames } from '@/lib/people';
import { formatDay, istanbulToday } from '@/lib/format';
import { Alert, Button, Card, PageTitle } from '@/components/ui';
import { ReportButton } from '@/components/report-button';
import { MessageButton } from '../pilots/pilot-actions';
import { RideForm } from './ride-form';
import { deleteRide, setRideClosed } from './actions';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale } = await params;
  const { kind } = await searchParams;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('rides');
  const common = await getTranslations('common');

  if (viewer.profile.age_group !== 'adult') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageTitle>{t('title')}</PageTitle>
        <Alert>{t('adultsOnly')}</Alert>
      </div>
    );
  }

  const today = istanbulToday();
  const supabase = await createClient();
  let query = supabase
    .from('rides')
    .select('*, sites:site_id(name, slug)')
    .gte('ride_date', today)
    .order('ride_date')
    .order('depart_time', { nullsFirst: false })
    .limit(200);
  if (kind === 'offer' || kind === 'request') query = query.eq('kind', kind);
  const [{ data: rides }, sites] = await Promise.all([query, listSites()]);
  const names = await displayNames(
    supabase,
    (rides ?? []).map((r) => r.user_id),
  );
  const days = new Map<string, NonNullable<typeof rides>>();
  for (const r of rides ?? []) days.set(r.ride_date, [...(days.get(r.ride_date) ?? []), r]);

  const filters = [
    { href: '/rides', label: t('all'), active: !kind },
    { href: '/rides?kind=offer', label: t('kindsPlural.offer'), active: kind === 'offer' },
    { href: '/rides?kind=request', label: t('kindsPlural.request'), active: kind === 'request' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-muted">{t('intro')}</p>
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">{t('new')}</summary>
        <div className="mt-4">
          <RideForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} today={today} />
        </div>
      </details>
      <nav aria-label={t('filter')} className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
              f.active ? 'border-brand-navy bg-brand-navy text-white' : 'border-border'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {days.size === 0 && <p className="text-muted">{t('empty')}</p>}
      {[...days].map(([day, list]) => (
        <section key={day} className="space-y-3">
          <h2 className="text-lg font-bold">{formatDay(day, locale)}</h2>
          {list.map((r) => {
            const mine = r.user_id === viewer.user.id;
            return (
              <Card key={r.id} className={`space-y-2 ${r.closed ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.kind === 'offer'
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                    }`}
                  >
                    {t(`kinds.${r.kind}`)}
                  </span>
                  <span className="text-xs text-muted">{t(`purposes.${r.purpose}`)}</span>
                  {r.closed && <span className="text-xs font-semibold">{t('closed')}</span>}
                </div>
                <p className="font-semibold">
                  {r.depart_time ? `${r.depart_time.slice(0, 5)} · ` : ''}
                  {r.from_text} → {[r.sites?.name, r.to_text].filter(Boolean).join(', ') || '—'}
                </p>
                {r.seats != null && (
                  <p className="text-sm">{t('seatsCount', { count: r.seats })}</p>
                )}
                {r.note && <p className="text-sm whitespace-pre-line">{r.note}</p>}
                <p className="text-sm text-muted">
                  {mine ? (
                    t('yours')
                  ) : (
                    <Link href={`/pilots/${r.user_id}`} className="hover:underline">
                      {names.get(r.user_id) ?? '—'}
                    </Link>
                  )}
                </p>
                <div className="flex flex-wrap items-start gap-3">
                  {mine ? (
                    <>
                      <form action={setRideClosed}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="closed" value={r.closed ? '0' : '1'} />
                        <Button variant="secondary">{r.closed ? t('reopen') : t('close')}</Button>
                      </form>
                      <form action={deleteRide}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button variant="danger">{common('delete')}</Button>
                      </form>
                    </>
                  ) : (
                    <>
                      {!r.closed && <MessageButton userId={r.user_id} />}
                      <ReportButton targetType="ride" targetId={r.id} />
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}
