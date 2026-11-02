import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { dueStatus, nextDueDate, type DueStatus } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActiveViewer } from '@/lib/session';
import { formatDate } from '@/lib/format';
import { Button, buttonClass, Card } from '@/components/ui';
import { markDone, setRetired } from './actions';

export const metadata: Metadata = { robots: { index: false } };

const tone: Record<DueStatus, string> = {
  ok: 'bg-background text-foreground',
  soon: 'bg-brand-yellow text-brand-navy',
  overdue: 'bg-brand-red text-white',
};

export default async function EquipmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('equipment');
  const supabase = await createClient();
  const [{ data: items }, { data: usage }] = await Promise.all([
    supabase
      .from('equipment')
      .select('*')
      .eq('user_id', viewer.user.id)
      .order('retired')
      .order('created_at', { ascending: false }),
    supabase
      .from('flights')
      .select('wing_id, duration_s')
      .eq('user_id', viewer.user.id)
      .not('wing_id', 'is', null),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  const hours = new Map<string, { flights: number; seconds: number }>();
  for (const f of usage ?? []) {
    const h = hours.get(f.wing_id!) ?? { flights: 0, seconds: 0 };
    hours.set(f.wing_id!, { flights: h.flights + 1, seconds: h.seconds + f.duration_s });
  }

  return (
    <div className="space-y-6">
      <p className="text-muted">{t('lead')}</p>
      <Link href="/account/equipment/new" className={buttonClass('primary')}>
        {t('add')}
      </Link>
      {items?.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const checkDue = nextDueDate(item.last_check_on, item.check_interval_months);
            const repackDue = nextDueDate(item.last_repack_on, item.repack_interval_months);
            const use = hours.get(item.id);
            const dues: { what: 'check' | 'repack'; due: string; status: DueStatus }[] = [];
            if (checkDue)
              dues.push({ what: 'check', due: checkDue, status: dueStatus(checkDue, today)! });
            if (repackDue)
              dues.push({ what: 'repack', due: repackDue, status: dueStatus(repackDue, today)! });
            return (
              <li key={item.id}>
                <Card className={`space-y-3 ${item.retired ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">
                        {t(`kinds.${item.kind}`)}
                      </p>
                      <h2 className="text-lg font-bold">
                        {[item.brand, item.model, item.size].filter(Boolean).join(' ')}
                      </h2>
                      {item.certification ? (
                        <p className="text-sm text-muted">{item.certification}</p>
                      ) : null}
                    </div>
                    {item.retired ? (
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold">
                        {t('retired')}
                      </span>
                    ) : null}
                  </div>
                  {use ? (
                    <p className="text-sm">
                      {t('usage', {
                        flights: use.flights,
                        hours: Math.round(use.seconds / 360) / 10,
                      })}
                    </p>
                  ) : null}
                  {!item.retired && dues.length ? (
                    <ul className="space-y-2">
                      {dues.map((d) => (
                        <li key={d.what} className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone[d.status]}`}
                          >
                            {t(`status.${d.status}`)}
                          </span>
                          <span className="flex-1 text-sm">
                            {t(d.what === 'check' ? 'checkDue' : 'repackDue', {
                              date: formatDate(d.due, locale),
                            })}
                          </span>
                          {d.status !== 'ok' ? (
                            <form action={markDone}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="what" value={d.what} />
                              <Button variant="secondary" className="min-h-11 px-3 text-sm">
                                {t(d.what === 'check' ? 'checkedToday' : 'repackedToday')}
                              </Button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Link
                      href={`/account/equipment/${item.id}`}
                      className={buttonClass('secondary')}
                    >
                      {t('edit')}
                    </Link>
                    <form action={setRetired}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="retired" value={item.retired ? 'false' : 'true'} />
                      <Button variant="ghost">{item.retired ? t('unretire') : t('retire')}</Button>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <p className="text-muted">{t('empty')}</p>
        </Card>
      )}
    </div>
  );
}
