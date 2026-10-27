import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { missingRequirements, seatsLeft, yearsFlying } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { publicUrl } from '@/lib/storage';
import { formatDateRange, getTrip, registrationOpen, tripDays, tripDestination } from '@/lib/trips';
import { currentTime, formatDate, formatDateTime, formatPrice, istanbulToday } from '@/lib/format';
import { Alert, buttonClass, Card } from '@/components/ui';
import { Markdown } from '@/components/markdown';
import { InterestButton, MyRegistration, RegisterForm } from './trip-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const trip = await getTrip(slug);
  if (!trip) return {};
  const cover = publicUrl('content', trip.cover_path);
  return {
    title: trip.title,
    description:
      trip.summary ??
      `${formatDateRange(trip.starts_on, trip.ends_on, locale)} · ${tripDestination(trip, locale) ?? ''}`,
    openGraph: cover ? { images: [cover] } : undefined,
    robots: trip.members_only || trip.status === 'draft' ? { index: false } : undefined,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trips');
  const levels = await getTranslations('account.profile.levels');
  const trip = await getTrip(slug);
  if (!trip) notFound();
  const supabase = await createClient();
  const viewer = await getViewer();
  const isActive = viewer ? (await getOnboardingStep(viewer)) === null : false;
  const [{ data: counts }, mine, interest] = await Promise.all([
    supabase.rpc('trip_counts', { p_trip: trip.id }),
    viewer
      ? supabase
          .from('trip_registrations')
          .select('status, note, phone, emergency_name, emergency_phone, payment_status')
          .eq('trip_id', trip.id)
          .eq('user_id', viewer.user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    viewer
      ? supabase
          .from('trip_interests')
          .select('trip_id')
          .eq('trip_id', trip.id)
          .eq('user_id', viewer.user.id)
          .maybeSingle()
          .then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ]);
  const c = counts?.[0];
  const left = seatsLeft(trip.max_pilots, Number(c?.seats_taken ?? 0));
  const waitlisted = Number(c?.waitlisted ?? 0);
  const open = registrationOpen(trip, currentTime(), istanbulToday());
  const active = mine && !['cancelled', 'declined'].includes(mine.status);
  const viewerYears = viewer ? yearsFlying(viewer.profile, new Date(currentTime())) : null;
  const missing = viewer
    ? missingRequirements(trip, {
        pilot_level: viewer.profile.pilot_level,
        years_flying: viewerYears,
      })
    : [];
  const minorBlocked = viewer ? !trip.allow_minors && viewer.profile.age_group !== 'adult' : false;
  const destination = tripDestination(trip, locale);
  const cover = publicUrl('content', trip.cover_path);
  const days = tripDays(trip.starts_on, trip.ends_on);
  const contact = {
    note: mine?.note ?? '',
    phone: mine?.phone ?? '',
    emergency_name: mine?.emergency_name ?? '',
    emergency_phone: mine?.emergency_phone ?? '',
  };
  const price = (n: number | null) =>
    n == null ? null : formatPrice(n, trip.price_currency, locale);

  return (
    <div className="space-y-6">
      <Link href="/trips" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      {cover ? (
        <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-card">
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <article className="min-w-0 space-y-8">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase text-muted">
              {destination ?? t('trip')}
              {trip.members_only ? ` · ${t('membersOnly')}` : ''}
            </p>
            <h1 className="text-3xl font-extrabold leading-tight">{trip.title}</h1>
            <p className="text-lg">
              {formatDateRange(trip.starts_on, trip.ends_on, locale)} · {t('days', { count: days })}
            </p>
            {trip.summary ? <p className="text-muted">{trip.summary}</p> : null}
            {trip.status === 'cancelled' ? (
              <Alert tone="error">{t('cancelledNotice')}</Alert>
            ) : null}
            {trip.status === 'draft' ? <Alert tone="info">{t('draftNotice')}</Alert> : null}
          </header>

          {trip.description_md ? <Markdown>{trip.description_md}</Markdown> : null}

          {trip.sites.length ? (
            <Section title={t('sites')}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {trip.sites.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sites/${s.slug}`}
                      className="flex min-h-11 flex-col justify-center rounded-xl border border-border bg-card px-4 py-2 hover:shadow-md"
                    >
                      <span className="font-semibold">{s.name}</span>
                      {s.region ? <span className="text-sm text-muted">{s.region}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">{t('sitesHelp')}</p>
            </Section>
          ) : null}

          {trip.itinerary_md ? (
            <Section title={t('itinerary')}>
              <Markdown>{trip.itinerary_md}</Markdown>
            </Section>
          ) : null}

          <Section title={t('requirements')}>
            <ul className="list-disc space-y-1 pl-5">
              {trip.min_pilot_level ? (
                <li>{t('minLevel', { level: levels(trip.min_pilot_level) })}</li>
              ) : null}
              {trip.min_years_flying != null ? (
                <li>{t('minYears', { count: trip.min_years_flying })}</li>
              ) : null}
              {trip.min_flights != null ? (
                <li>{t('minFlights', { count: trip.min_flights })}</li>
              ) : null}
              {trip.required_equipment.map((e) => (
                <li key={e}>{t(`equipment.${e}` as 'equipment.reserve')}</li>
              ))}
              <li>{trip.allow_minors ? t('minorsAllowed') : t('adultsOnly')}</li>
            </ul>
            {trip.requirements_md ? <Markdown>{trip.requirements_md}</Markdown> : null}
            {viewer && missing.length ? (
              <Alert tone="error">
                {t('youMiss', {
                  level: viewer.profile.pilot_level ? levels(viewer.profile.pilot_level) : '—',
                  years: viewerYears ?? 0,
                })}{' '}
                <Link href="/account/profile" className="underline">
                  {t('updateProfile')}
                </Link>
              </Alert>
            ) : null}
          </Section>

          {trip.guides.length ? (
            <Section title={t('guides')}>
              <ul className="flex flex-wrap gap-2">
                {trip.guides.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/pilots/${g.id}`}
                      className="flex min-h-11 flex-col justify-center rounded-xl border border-border bg-card px-4 py-2 hover:shadow-md"
                    >
                      <span className="font-semibold">{g.name ?? t('guide')}</span>
                      {g.role ? <span className="text-sm text-muted">{g.role}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title={t('priceAndPayment')}>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold">{t('price')}</dt>
              <dd>{price(trip.price_amount) ?? t('priceTbd')}</dd>
              {trip.deposit_amount != null ? (
                <>
                  <dt className="font-semibold">{t('deposit')}</dt>
                  <dd>{price(trip.deposit_amount)}</dd>
                </>
              ) : null}
              {trip.payment_deadline ? (
                <>
                  <dt className="font-semibold">{t('paymentDeadline')}</dt>
                  <dd>{formatDate(`${trip.payment_deadline}T12:00:00Z`, locale)}</dd>
                </>
              ) : null}
              {trip.price_includes ? (
                <>
                  <dt className="font-semibold">{t('includes')}</dt>
                  <dd className="whitespace-pre-line">{trip.price_includes}</dd>
                </>
              ) : null}
              {trip.price_excludes ? (
                <>
                  <dt className="font-semibold">{t('excludes')}</dt>
                  <dd className="whitespace-pre-line">{trip.price_excludes}</dd>
                </>
              ) : null}
            </dl>
            {active && trip.payment_info_md ? <Markdown>{trip.payment_info_md}</Markdown> : null}
            {trip.cancellation_policy ? (
              <div>
                <h3 className="font-semibold">{t('cancellationPolicy')}</h3>
                <p className="whitespace-pre-line text-muted">{trip.cancellation_policy}</p>
              </div>
            ) : null}
            <p className="text-sm text-muted">{t('paymentOffline')}</p>
          </Section>

          {trip.accommodation || trip.transport || trip.meeting_point ? (
            <Section title={t('logistics')}>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
                {trip.meeting_point || trip.meeting_at ? (
                  <>
                    <dt className="font-semibold">{t('meeting')}</dt>
                    <dd>
                      {[
                        trip.meeting_point,
                        trip.meeting_at ? formatDateTime(trip.meeting_at, locale) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </>
                ) : null}
                {trip.accommodation ? (
                  <>
                    <dt className="font-semibold">{t('accommodation')}</dt>
                    <dd className="whitespace-pre-line">{trip.accommodation}</dd>
                  </>
                ) : null}
                {trip.transport ? (
                  <>
                    <dt className="font-semibold">{t('transport')}</dt>
                    <dd className="whitespace-pre-line">{trip.transport}</dd>
                  </>
                ) : null}
              </dl>
            </Section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card className="space-y-4 lg:sticky lg:top-24">
            <div>
              <p className="text-2xl font-extrabold">{price(trip.price_amount) ?? t('priceTbd')}</p>
              <p className="text-sm text-muted">
                {left > 0 ? t('seatsLeft', { count: left, max: trip.max_pilots }) : t('full')}
                {waitlisted ? ` · ${t('waitlistCount', { count: waitlisted })}` : ''}
              </p>
              {Number(c?.interested ?? 0) ? (
                <p className="text-sm text-muted">
                  {t('interestedCount', { count: Number(c?.interested ?? 0) })}
                </p>
              ) : null}
              {trip.min_pilots ? (
                <p className="text-sm text-muted">
                  {t('minPilotsNote', { count: trip.min_pilots })}
                </p>
              ) : null}
              {trip.registration_deadline ? (
                <p className="text-sm text-muted">
                  {t('deadline', { date: formatDateTime(trip.registration_deadline, locale) })}
                </p>
              ) : null}
              {trip.registration_opens_at &&
              new Date(trip.registration_opens_at).getTime() > currentTime() ? (
                <p className="text-sm font-semibold">
                  {t('opensAt', { date: formatDateTime(trip.registration_opens_at, locale) })}
                </p>
              ) : null}
            </div>

            {!viewer ? (
              <Link href="/auth/sign-in" className={buttonClass('primary', 'w-full')}>
                {t('signInToJoin')}
              </Link>
            ) : !isActive ? null : active ? (
              <>
                <Alert tone={mine.status === 'accepted' ? 'success' : 'info'}>
                  <strong>{t(`status.${mine.status}`)}</strong>
                  <br />
                  {t(`statusHelp.${mine.status}`)}
                  {mine.status === 'accepted' ? (
                    <>
                      <br />
                      {t(`payment.${mine.payment_status}`)}
                    </>
                  ) : null}
                </Alert>
                <MyRegistration tripId={trip.id} values={contact} />
              </>
            ) : mine?.status === 'declined' ? (
              <p className="text-sm text-muted">{t('statusHelp.declined')}</p>
            ) : open && !minorBlocked && !missing.length ? (
              <RegisterForm
                tripId={trip.id}
                companionsAllowed={trip.companions_allowed}
                waitlist={left === 0 || waitlisted > 0}
                defaults={contact}
              />
            ) : (
              <p className="text-sm text-muted">
                {minorBlocked
                  ? t('adultsOnly')
                  : missing.length
                    ? t('requirementsNotMet')
                    : t('closedNotice')}
              </p>
            )}

            {viewer &&
            isActive &&
            !active &&
            ['open', 'closed'].includes(trip.status) &&
            !minorBlocked ? (
              <InterestButton tripId={trip.id} interested={interest} />
            ) : null}

            <a
              href={`/api/trips/${trip.id}/ics`}
              className={buttonClass('secondary', 'w-full')}
              download
            >
              {t('addToCalendar')}
            </a>
          </Card>
          {viewer && canUse(viewer, 'trips') ? (
            <Link href={`/admin/trips/${trip.id}`} className={buttonClass('ghost', 'w-full')}>
              {t('manage')}
            </Link>
          ) : viewer && trip.guides.some((g) => g.id === viewer.user.id) ? (
            <Link
              href={`/trips/${trip.slug}/participants`}
              className={buttonClass('ghost', 'w-full')}
            >
              {t('participantsForGuides')}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
