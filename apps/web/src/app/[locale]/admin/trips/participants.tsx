import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';
import { formatDateTime } from '@/lib/format';
import { buttonClass, Card } from '@/components/ui';
import { GroupChatForm, NotifyForm, ParticipantForm } from './participant-row';

const ORDER = ['accepted', 'pending', 'waitlisted', 'declined', 'cancelled'] as const;

/** Participants for organisers and the trip's guides (RLS: private.is_trip_staff()). */
export async function Participants({
  tripId,
  locale,
  maxPilots,
}: {
  tripId: string;
  locale: string;
  maxPilots: number;
}) {
  const t = await getTranslations('admin.tripsAdmin');
  const tr = await getTranslations('trips');
  const levels = await getTranslations('account.profile.levels');
  const supabase = await createClient();
  const [{ data: regs }, { data: interests }] = await Promise.all([
    supabase.from('trip_registrations').select('*').eq('trip_id', tripId).order('created_at'),
    supabase.from('trip_interests').select('user_id, created_at').eq('trip_id', tripId),
  ]);
  const names = await displayNames(supabase, [
    ...(regs ?? []).map((r) => r.user_id),
    ...(interests ?? []).map((i) => i.user_id),
  ]);
  const taken = (regs ?? [])
    .filter((r) => r.status === 'accepted' || r.status === 'pending')
    .reduce((n, r) => n + 1 + r.companions, 0);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">
            {t('participants')} ({taken}/{maxPilots})
          </h3>
          <a
            href={`/api/trips/${tripId}/participants`}
            className={buttonClass('secondary')}
            download
          >
            {t('downloadCsv')}
          </a>
        </div>
        {ORDER.map((status) => {
          const rows = (regs ?? []).filter((r) => r.status === status);
          if (!rows.length) return null;
          return (
            <section key={status} className="space-y-2">
              <h4 className="font-semibold">
                {tr(`status.${status}`)} ({rows.length})
              </h4>
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const name = names.get(r.user_id) ?? '—';
                  return (
                    <li key={r.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <Link
                          href={`/pilots/${r.user_id}`}
                          className="font-semibold hover:underline"
                        >
                          {name}
                        </Link>
                        <span className="text-sm text-muted">
                          {[
                            r.pilot_level ? levels(r.pilot_level) : null,
                            r.years_flying != null
                              ? t('yearsShort', { count: r.years_flying })
                              : null,
                            r.logged_flights != null
                              ? t('flightsShort', { count: r.logged_flights })
                              : null,
                            r.companions ? t('companionsShort', { count: r.companions }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="text-xs text-muted">
                          {formatDateTime(r.created_at, locale)}
                        </span>
                      </div>
                      <p className="text-sm">
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="underline">
                            {r.phone}
                          </a>
                        ) : null}
                        {r.emergency_name || r.emergency_phone ? (
                          <span className="text-muted">
                            {' '}
                            · {t('emergency')}: {r.emergency_name} {r.emergency_phone}
                          </span>
                        ) : null}
                      </p>
                      {r.note ? <p className="text-sm italic">“{r.note}”</p> : null}
                      <ParticipantForm
                        id={r.id}
                        name={name}
                        status={r.status}
                        payment={r.payment_status}
                        staffNote={r.staff_note ?? ''}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!regs?.length ? <p className="text-sm text-muted">{t('noParticipants')}</p> : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-lg font-bold">
          {tr('interested')} ({interests?.length ?? 0})
        </h3>
        <ul className="flex flex-wrap gap-2 text-sm">
          {(interests ?? []).map((i) => (
            <li key={i.user_id}>
              <Link href={`/pilots/${i.user_id}`} className="underline">
                {names.get(i.user_id) ?? '—'}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-lg font-bold">{t('notify')}</h3>
          <NotifyForm tripId={tripId} />
        </Card>
        <Card className="space-y-2">
          <h3 className="text-lg font-bold">{t('groupChat')}</h3>
          <GroupChatForm tripId={tripId} />
        </Card>
      </div>
    </div>
  );
}
