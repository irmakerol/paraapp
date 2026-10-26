import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireStaff } from '@/lib/staff';
import { listSites } from '@/lib/sites';
import { EventForm } from '../event-form';

export default async function NewEventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'events');
  const t = await getTranslations('admin.eventsAdmin');
  const sites = await listSites();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">{t('new')}</h2>
      <EventForm
        id={null}
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        values={{
          title: '',
          description_md: '',
          kind: 'club_trip',
          starts_at: '',
          ends_at: '',
          site_id: '',
          location_text: '',
          members_only: false,
          capacity: '',
          rsvp_deadline: '',
          status: 'draft',
        }}
      />
    </div>
  );
}
