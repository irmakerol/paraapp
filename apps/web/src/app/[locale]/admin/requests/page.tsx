import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { currentTime, formatDate } from '@/lib/format';
import { Button, Card, Select, Textarea } from '@/components/ui';
import { updateRequest } from './actions';
import { LogRequestForm } from './log-form';

const TYPES = [
  'access',
  'rectification',
  'erasure',
  'restriction',
  'portability',
  'objection',
  'withdraw_consent',
  'other',
] as const;
const STATUSES = ['received', 'in_progress', 'completed', 'rejected'] as const;

export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'requests');
  const t = await getTranslations('admin.requestsAdmin');
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from('data_requests')
    .select('*')
    .order('due_at', { ascending: true })
    .limit(300);
  const now = currentTime();

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {(requests ?? []).map((r) => {
          const open = r.status === 'received' || r.status === 'in_progress';
          const overdue = open && new Date(r.due_at).getTime() < now;
          return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {t(`types.${r.request_type}`)} · {r.requester_email}
                </p>
                <p className={`text-sm ${overdue ? 'font-bold text-danger' : 'text-muted'}`}>
                  {t('received')} {formatDate(r.received_at, locale)} · {t('due')}{' '}
                  {formatDate(r.due_at, locale)}
                  {overdue ? ` · ${t('overdue')}` : ''}
                </p>
              </div>
              {r.details ? <p className="mt-2 whitespace-pre-line text-sm">{r.details}</p> : null}
              <form
                action={updateRequest}
                className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]"
              >
                <input type="hidden" name="id" value={r.id} />
                <Select name="status" defaultValue={r.status} aria-label={t('status')}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </Select>
                <Textarea name="notes" rows={1} defaultValue={r.notes ?? ''} aria-label="notes" />
                <Button variant="secondary">{t('save')}</Button>
              </form>
            </li>
          );
        })}
      </ul>
      <Card>
        <LogRequestForm types={TYPES.map((value) => ({ value, label: t(`types.${value}`) }))} />
      </Card>
    </div>
  );
}
