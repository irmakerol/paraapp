import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_UNITS, fieldPrivacySchema, type UnitPreferences } from '@paraapp/core';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { decryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RoleBadges } from '@/components/role-badges';
import { buttonClass } from '@/components/ui';
import { ProfileForm } from './profile-form';

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { locale } = await params;
  const { saved } = await searchParams;
  setRequestLocale(locale);
  const { profile, roles } = await requireActiveViewer(locale);
  const supabase = await createClient();
  const { data: priv } = await supabase
    .from('profile_private')
    .select('licence_number_enc, licence_body')
    .eq('user_id', profile.id)
    .maybeSingle();

  let licence = '';
  if (priv?.licence_number_enc) {
    try {
      licence = decryptField(priv.licence_number_enc, serverEnv().LICENCE_ENCRYPTION_KEY);
    } catch {
      licence = '';
    }
  }

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  const privacy = fieldPrivacySchema.parse(profile.field_privacy);
  const units = { ...DEFAULT_UNITS, ...(profile.units as Partial<UnitPreferences>) };

  return (
    <div className="space-y-6">
      <ProfileSummary
        userId={profile.id}
        roles={roles}
        level={profile.pilot_level}
        instructor={profile.is_instructor}
        hours={Number(profile.total_flight_hours ?? 0)}
        flights={profile.total_flights ?? 0}
        locale={locale}
      />
      <ProfileForm
        userId={profile.id}
        profile={{
          display_name: profile.display_name,
          full_name: profile.full_name ?? '',
          country: profile.country ?? '',
          city: profile.city ?? '',
          home_site: profile.home_site ?? '',
          pilot_level: profile.pilot_level ?? '',
          training_level: profile.training_level ?? '',
          is_instructor: profile.is_instructor,
          flying_since: profile.flying_since?.toString() ?? '',
          weight_kg: profile.weight_kg?.toString() ?? '',
          total_flight_hours: String(profile.total_flight_hours ?? 0),
          total_flights: String(profile.total_flights ?? 0),
          wings: profile.wings ?? '',
          bio: profile.bio ?? '',
          locale: profile.locale,
        }}
        privacy={privacy}
        units={units}
        licence={licence}
        licenceBody={priv?.licence_body ?? ''}
        avatarUrl={avatarUrl}
        isMinor={profile.age_group === 'minor'}
        isStudent={roles.includes('student_pilot')}
        justSaved={saved === '1'}
      />
    </div>
  );
}

/** What others see at a glance: roles, level and flight totals, with a link to the public page. */
async function ProfileSummary({
  userId,
  roles,
  level,
  instructor,
  hours,
  flights,
  locale,
}: {
  userId: string;
  roles: readonly string[];
  level: string | null;
  instructor: boolean;
  hours: number;
  flights: number;
  locale: string;
}) {
  const t = await getTranslations('pilots');
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <RoleBadges roles={roles} level={level} instructor={instructor} />
        <p className="text-sm">
          {t('totals', {
            hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours),
            flights,
          })}
        </p>
      </div>
      <Link href={`/pilots/${userId}`} className={buttonClass('secondary')}>
        {t('viewPublic')}
      </Link>
    </section>
  );
}
