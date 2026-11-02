import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { eventLocation, getEvent } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import { Alert, buttonClass, Card } from '@/components/ui';
import { Markdown } from '@/components/markdown';
import { ReportButton } from '@/components/report-button';
import { RsvpForm } from './rsvp-form';
import { sampleLabel } from '@/lib/sample';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const event = await getEvent(slug);
  if (!event) return {};
  return {
    title: sampleLabel(event.title, locale),
    description: `${formatDateTime(event.starts_at, locale)} · ${event.description_md.slice(0, 140)}`,
    robots: event.members_only || event.status === 'draft' ? { index: false } : undefined,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const event = await getEvent(slug);
  if (!event) notFound();
  const supabase = await createClient();
  const viewer = await getViewer();
  const isActive = viewer ? (await getOnboardingStep(viewer)) === null : false;
  const [{ data: counts }, mine] = await Promise.all([
    supabase.rpc('event_counts', { p_event: event.id }),
    viewer
      ? supabase
          .from('event_rsvps')
          .select('status, note')
          .eq('event_id', event.id)
          .eq('user_id', viewer.user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const going = Number(counts?.[0]?.going ?? 0);
  const maybe = Number(counts?.[0]?.maybe ?? 0);
  const now = new Date();
  const open =
    event.status === 'published' &&
    new Date(event.ends_at) > now &&
    (!event.rsvp_deadline || new Date(event.rsvp_deadline) > now);
  const location = eventLocation(event);

  return (
    <div className="space-y-6">
      <Link href="/events" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article className="space-y-4">
          <p className="text-sm font-semibold uppercase text-muted">
            {t(`kinds.${event.kind}`)}
            {event.members_only ? ` · ${t('membersOnly')}` : ''}
          </p>
          <h1 className="text-3xl font-extrabold leading-tight">
            {sampleLabel(event.title, locale)}
          </h1>
          {event.status === 'cancelled' ? <Alert tone="error">{t('cancelledNotice')}</Alert> : null}
          <p className="text-lg">
            {formatDateTime(event.starts_at, locale)} – {formatDateTime(event.ends_at, locale)}
          </p>
          {location ? (
            <p className="text-muted">
              {location}
              {event.sites ? (
                <>
                  {' · '}
                  <Link href={`/sites/${event.sites.slug}`} className="underline">
                    {t('sitePage')}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {event.description_md ? <Markdown>{event.description_md}</Markdown> : null}
        </article>
        <aside className="space-y-4">
          <Card className="space-y-3">
            <p className="text-sm">
              {t('counts', { going, maybe })}
              {event.capacity ? ` · ${t('capacity', { capacity: event.capacity })}` : ''}
            </p>
            {event.rsvp_deadline ? (
              <p className="text-sm text-muted">
                {t('deadline', { date: formatDateTime(event.rsvp_deadline, locale) })}
              </p>
            ) : null}
            {!viewer ? (
              <Link href="/auth/sign-in" className={buttonClass('primary', 'w-full')}>
                {t('signInToJoin')}
              </Link>
            ) : !isActive ? null : open ? (
              <RsvpForm eventId={event.id} current={mine?.status ?? null} note={mine?.note ?? ''} />
            ) : (
              <p className="text-sm text-muted">
                {mine
                  ? t('yourAnswerWas', { answer: t(`rsvp.${mine.status}`) })
                  : t('closedNotice')}
              </p>
            )}
            <a
              href={`/api/events/${event.id}/ics`}
              className={buttonClass('secondary', 'w-full')}
              download
            >
              {t('addToCalendar')}
            </a>
          </Card>
          {viewer && canUse(viewer, 'events') ? (
            <Link href={`/admin/events/${event.id}`} className={buttonClass('ghost', 'w-full')}>
              {t('manage')}
            </Link>
          ) : null}
          {viewer && !canUse(viewer, 'events') ? (
            <ReportButton targetType="event" targetId={event.id} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
