import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { avatarUrl, followState, getPilotCard } from '@/lib/pilots';
import { listFlights, pilotStats } from '@/lib/flights';
import { buttonClass, Card } from '@/components/ui';
import { FlightList } from '@/components/flight-list';
import { StatsGrid } from '@/components/stats-grid';
import { ReportButton } from '@/components/report-button';
import { BlockButton } from '@/components/block-button';
import { createClient } from '@/lib/supabase/server';
import { FollowButton, MessageButton } from '../pilot-actions';
import { sampleLabel } from '@/lib/sample';
import { RoleBadges } from '@/components/role-badges';
import { formatDate } from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const card = await getPilotCard(id);
  if (!card) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: 'pilots' });
  return {
    title: sampleLabel(card.display_name, locale) ?? t('pilot'),
    description: card.bio?.slice(0, 160) ?? t('metaDescription', { name: card.display_name ?? '' }),
  };
}

export default async function PilotPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pilots');
  const account = await getTranslations('account.profile');
  const viewer = await getViewer();
  const isSelf = viewer?.user.id === id;
  const [card, flights] = await Promise.all([getPilotCard(id), listFlights(id, 500)]);
  if (!card && !flights.length && !isSelf) notFound();

  const isActive = viewer ? (await getOnboardingStep(viewer)) === null : false;
  const [stats, follow, photo] = await Promise.all([
    pilotStats(id),
    followState(viewer?.user.id, id),
    avatarUrl(card?.avatar_path ?? null),
  ]);
  let blocked = false;
  if (viewer && !isSelf) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', viewer.user.id)
      .eq('blocked_id', id)
      .maybeSingle();
    blocked = Boolean(data);
  }
  const name = sampleLabel(card?.display_name, locale) ?? t('pilot');
  const facts = [
    card?.flying_since != null
      ? t('flyingSince', { year: card.flying_since })
      : card?.years_flying != null
        ? t('yearsFlying', { years: card.years_flying })
        : null,
    card?.home_site ? t('homeSite', { site: card.home_site }) : null,
    [card?.city, card?.country].filter(Boolean).join(', ') || null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-5">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={96}
            height={96}
            className="size-24 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex size-24 items-center justify-center rounded-full bg-brand-navy text-3xl font-extrabold text-white"
            aria-hidden
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-3xl font-extrabold">{name}</h1>
          {card ? (
            <RoleBadges
              roles={card.roles ?? []}
              level={card.pilot_level}
              trainingLevel={card.training_level}
              instructor={card.is_instructor}
            />
          ) : null}
          {card?.full_name && card.full_name !== card.display_name ? (
            <p className="text-muted">{card.full_name}</p>
          ) : null}
          {facts.length ? <p className="text-sm text-muted">{facts.join(' · ')}</p> : null}
          <p className="text-sm">
            {t('followers', { count: follow.followers })} ·{' '}
            {t('following', { count: follow.following })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSelf ? (
            <Link href="/account" className={buttonClass('secondary')}>
              {t('editProfile')}
            </Link>
          ) : isActive ? (
            <>
              <FollowButton userId={id} following={follow.isFollowing} />
              <MessageButton userId={id} />
              <Link href={`/pilots/${id}/compare`} className={buttonClass('ghost')}>
                {t('compare')}
              </Link>
            </>
          ) : !viewer ? (
            <Link href="/auth/sign-in" className={buttonClass('primary')}>
              {t('follow')}
            </Link>
          ) : null}
        </div>
      </header>
      {card?.wings ? <p className="text-sm">{t('flies', { wings: card.wings })}</p> : null}
      {card ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('stats')}>
          <Tile
            label={t('totalHours')}
            value={
              card.total_flight_hours != null
                ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                    Number(card.total_flight_hours),
                  )
                : '—'
            }
          />
          <Tile
            label={t('totalFlights')}
            value={card.total_flights != null ? String(card.total_flights) : '—'}
          />
          <Tile
            label={t('yearsFlyingStat')}
            value={card.years_flying != null ? String(card.years_flying) : '—'}
            note={
              card.flying_since != null ? t('sinceStat', { year: card.flying_since }) : undefined
            }
          />
          <Tile
            label={t('levelStat')}
            value={card.pilot_level ? account(`levels.${card.pilot_level}`) : t('noLevel')}
            note={t('memberSince', { date: formatDate(card.created_at, locale) })}
          />
        </section>
      ) : null}
      {card?.weight_kg != null ? (
        <p className="text-sm">{t('weight', { kg: card.weight_kg })}</p>
      ) : null}
      {card?.bio ? <p className="whitespace-pre-line">{card.bio}</p> : null}
      {card ? null : <p className="text-sm text-muted">{t('privateProfile')}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('stats')}</h2>
        <StatsGrid stats={stats} locale={locale} />
        {!isSelf ? <p className="text-xs text-muted">{t('statsNote')}</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('flights')}</h2>
        {flights.length ? (
          <FlightList flights={flights} showVisibility={isSelf} />
        ) : (
          <Card>
            <p className="text-muted">{t('noFlights')}</p>
          </Card>
        )}
      </section>
      {viewer && !isSelf ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <BlockButton userId={id} blocked={blocked} />
          <ReportButton targetType="user" targetId={id} />
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  );
}
