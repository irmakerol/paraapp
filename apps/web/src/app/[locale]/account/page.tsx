import { setRequestLocale } from 'next-intl/server';
import {
  DEFAULT_UNITS,
  fieldPrivacySchema,
  isMemberLevel,
  type UnitPreferences,
} from '@paraapp/core';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { decryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { ProfileForm } from './profile-form';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile, roles } = await requireActiveViewer(locale);
  const supabase = await createClient();
  const { data: priv } = await supabase
    .from('profile_private')
    .select('licence_number_enc')
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
    <ProfileForm
      userId={profile.id}
      profile={{
        display_name: profile.display_name,
        full_name: profile.full_name ?? '',
        country: profile.country ?? '',
        city: profile.city ?? '',
        home_site: profile.home_site ?? '',
        pilot_level: profile.pilot_level ?? '',
        years_flying: profile.years_flying?.toString() ?? '',
        wings: profile.wings ?? '',
        bio: profile.bio ?? '',
        locale: profile.locale,
      }}
      privacy={privacy}
      units={units}
      licence={licence}
      avatarUrl={avatarUrl}
      isMinor={profile.age_group === 'minor'}
      isMember={isMemberLevel(roles)}
    />
  );
}
