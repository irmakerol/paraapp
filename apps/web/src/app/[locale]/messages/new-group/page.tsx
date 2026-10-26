import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActiveViewer } from '@/lib/session';
import { followedPeople } from '@/lib/people';
import { Alert, PageTitle } from '@/components/ui';
import { NewGroupForm } from '../group-forms';

export default async function NewGroupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('groups');
  if (viewer.profile.age_group !== 'adult') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle>{t('new')}</PageTitle>
        <Alert>{t('adultsOnly')}</Alert>
      </div>
    );
  }
  const supabase = await createClient();
  const people = await followedPeople(supabase, viewer.user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle lead={t('newLead')}>{t('new')}</PageTitle>
      {people.length ? (
        <NewGroupForm people={people} />
      ) : (
        <Alert>
          {t('followFirst')}{' '}
          <Link href="/pilots" className="underline">
            {t('findPilots')}
          </Link>
        </Alert>
      )}
    </div>
  );
}
