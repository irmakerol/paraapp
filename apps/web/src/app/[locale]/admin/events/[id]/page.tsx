import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { listSites } from '@/lib/sites';
import { displayNames } from '@/lib/people';
import { isoToIstanbulLocal } from '@/lib/format';
import { Button, Card } from '@/components/ui';
import { EventForm } from '../event-form';
import { deleteEvent } from '../actions';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'events');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.eventsAdmin');
  const ev = await getTranslations('events');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const [{ data: event }, { data: rsvps }, sites] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('event_rsvps')
      .select('user_id, status, note')
      .eq('event_id', id)
      .order('created_at'),
    listSites(),
  ]);
  if (!event) notFound();
  const names = await displayNames(
    supabase,
    (rsvps ?? []).map((r) => r.user_id),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('edit')}</h2>
        <Link href={`/events/${event.slug}`} className="text-sm underline">
          /events/{event.slug}
        </Link>
      </div>
      <EventForm
        id={event.id}
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        values={{
          title: event.title,
          description_md: event.description_md,
          kind: event.kind,
          starts_at: isoToIstanbulLocal(event.starts_at),
          ends_at: isoToIstanbulLocal(event.ends_at),
          site_id: event.site_id ?? '',
          location_text: event.location_text ?? '',
          members_only: event.members_only,
          capacity: event.capacity != null ? String(event.capacity) : '',
          rsvp_deadline: isoToIstanbulLocal(event.rsvp_deadline),
          status: event.status,
        }}
      />
      <Card className="space-y-3">
        <h3 className="font-bold">
          {t('attendees')} ({(rsvps ?? []).filter((r) => r.status === 'going').length})
        </h3>
        <ul className="divide-y divide-border text-sm">
          {(rsvps ?? []).map((r) => (
            <li key={r.user_id} className="flex flex-wrap gap-2 py-2">
              <Link href={`/pilots/${r.user_id}`} className="font-semibold hover:underline">
                {names.get(r.user_id) ?? '—'}
              </Link>
              <span className="text-muted">{ev(`rsvp.${r.status}`)}</span>
              {r.note && <span className="w-full text-muted">{r.note}</span>}
            </li>
          ))}
          {!rsvps?.length && <li className="py-2 text-muted">{t('noAttendees')}</li>}
        </ul>
      </Card>
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-danger">{common('delete')}</summary>
        <form action={deleteEvent} className="mt-3 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
