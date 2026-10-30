import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { eventLocation } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { Tabs } from '@/components/tabs';
import { sampleLabel } from '@/lib/sample';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  return { title: t('title'), description: t('lead') };
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ past?: string }>;
}) {
  const { locale } = await params;
  const past = (await searchParams).past === '1';
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase
    .from('events')
    .select(
      'id, slug, title, kind, starts_at, ends_at, status, members_only, location_text, sites:site_id(name)',
    )
    .in('status', ['published', 'cancelled'])
    .limit(100);
  query = past
    ? query.lt('ends_at', now).order('starts_at', { ascending: false })
    : query.gte('ends_at', now).order('starts_at');
  const { data: events } = await query;

  return (
    <div className="space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <Tabs
        tabs={[
          { href: '/events', label: t('upcoming') },
          { href: '/events?past=1', label: t('past') },
        ]}
      />
      {events?.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                className="block h-full rounded-2xl border border-border bg-card p-5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase text-muted">
                  {t(`kinds.${e.kind}`)}
                  {e.members_only ? ` · ${t('membersOnly')}` : ''}
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${e.status === 'cancelled' ? 'line-through' : ''}`}
                >
                  {sampleLabel(e.title, locale)}
                </p>
                <p className="text-sm text-muted">
                  {formatDateTime(e.starts_at, locale)}
                  {eventLocation(e) ? ` · ${eventLocation(e)}` : ''}
                </p>
                {e.status === 'cancelled' ? (
                  <p className="mt-1 text-sm font-bold text-brand-red">{t('cancelled')}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-muted">{past ? t('noPast') : t('empty')}</p>
        </Card>
      )}
    </div>
  );
}
