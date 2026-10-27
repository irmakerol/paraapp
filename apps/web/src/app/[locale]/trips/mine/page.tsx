import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { requireActiveViewer } from '@/lib/session';
import { Card, PageTitle } from '@/components/ui';
import { Tabs } from '@/components/tabs';
import { TripCard } from '../trip-card';

export const metadata: Metadata = { robots: { index: false } };

const FIELDS =
  'slug, title, summary, cover_path, starts_on, ends_on, destination_country, destination_region, price_amount, price_currency, status, members_only, min_pilot_level';

export default async function MyTripsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('trips');
  const supabase = await createClient();
  const [{ data: regs }, { data: interests }] = await Promise.all([
    supabase
      .from('trip_registrations')
      .select(`status, trips:trip_id(${FIELDS})`)
      .eq('user_id', viewer.user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('trip_interests')
      .select(`trips:trip_id(${FIELDS})`)
      .eq('user_id', viewer.user.id)
      .order('created_at', { ascending: false }),
  ]);
  const registered = (regs ?? []).filter((r) => r.trips);
  const interested = (interests ?? []).filter((r) => r.trips);

  return (
    <div className="space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <Tabs
        tabs={[
          { href: '/trips', label: t('upcoming') },
          { href: '/trips?past=1', label: t('past') },
          { href: '/trips/mine', label: t('mine') },
        ]}
      />
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('myRegistrations')}</h2>
        {registered.length ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {registered.map((r) => (
              <li key={r.trips!.slug}>
                <TripCard trip={r.trips!} locale={locale} badge={t(`status.${r.status}`)} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">{t('noRegistrations')}</p>
          </Card>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('myInterests')}</h2>
        {interested.length ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {interested.map((r) => (
              <li key={r.trips!.slug}>
                <TripCard trip={r.trips!} locale={locale} badge={`★ ${t('interested')}`} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">{t('noInterests')}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
