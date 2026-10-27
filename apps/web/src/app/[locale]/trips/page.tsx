import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { istanbulToday } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { Tabs } from '@/components/tabs';
import { TripCard } from './trip-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'trips' });
  return { title: t('title'), description: t('lead') };
}

const TRIP_CARD_FIELDS =
  'id, slug, title, summary, cover_path, starts_on, ends_on, destination_country, destination_region, price_amount, price_currency, status, members_only, min_pilot_level';

export default async function TripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ past?: string }>;
}) {
  const { locale } = await params;
  const past = (await searchParams).past === '1';
  setRequestLocale(locale);
  const t = await getTranslations('trips');
  const viewer = await getViewer();
  const supabase = await createClient();
  const today = istanbulToday();
  let query = supabase.from('trips').select(TRIP_CARD_FIELDS).neq('status', 'draft').limit(100);
  query = past
    ? query.lt('ends_on', today).order('starts_on', { ascending: false })
    : query.gte('ends_on', today).order('starts_on');
  const { data: trips } = await query;

  return (
    <div className="space-y-6">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <Tabs
        tabs={[
          { href: '/trips', label: t('upcoming') },
          { href: '/trips?past=1', label: t('past') },
          ...(viewer ? [{ href: '/trips/mine', label: t('mine') }] : []),
        ]}
      />
      {trips?.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={trip} locale={locale} />
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
