import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui';
import { BroadcastForm } from './broadcast-form';

export default async function BroadcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'broadcast');
  const t = await getTranslations('admin.broadcastAdmin');
  const roles = await getTranslations('roles');
  const supabase = await createClient();
  const [{ data: groups }, { data: sent }, { data: reads }] = await Promise.all([
    supabase.from('user_groups').select('id, name').order('name'),
    supabase
      .from('club_messages')
      .select('id, audience, audience_role, audience_label, title, recipient_count, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('club_message_recipients').select('message_id').not('read_at', 'is', null),
  ]);
  const readCount = new Map<string, number>();
  for (const r of reads ?? []) readCount.set(r.message_id, (readCount.get(r.message_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <p className="text-muted">{t('lead')}</p>
      <BroadcastForm locale={locale} groups={groups ?? []} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('history')}</h2>
        {sent?.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {sent.map((m) => (
              <li key={m.id} className="space-y-1 px-4 py-3">
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-muted">
                  {formatDateTime(m.created_at, locale)} ·{' '}
                  {m.audience === 'all'
                    ? t('audiences.all')
                    : m.audience === 'role' && m.audience_role
                      ? roles(m.audience_role)
                      : (m.audience_label ?? '—')}{' '}
                  · {t('readStats', { read: readCount.get(m.id) ?? 0, total: m.recipient_count })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">{t('noHistory')}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
