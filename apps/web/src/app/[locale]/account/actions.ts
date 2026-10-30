'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CONSENT_TYPES,
  LICENCE_BODIES,
  licenceNumberSchema,
  profileSchema,
  type ConsentType,
} from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { removeUserFiles } from '@/lib/account-files';
import { getUser } from '@/lib/session';
import { encryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { routing } from '@/i18n/routing';
import type { ActionState } from '@/lib/action-state';

function localeFrom(formData: FormData): string {
  const value = String(formData.get('locale') ?? '');
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

async function requireUser(formData: FormData) {
  const user = await getUser();
  if (!user) redirect(`/${localeFrom(formData)}/auth/sign-in`);
  return user;
}

const preferencesSchema = z.object({
  locale: z.enum(routing.locales),
  units_system: z.enum(['metric', 'imperial']),
  units_speed: z.enum(['kmh', 'ms', 'mph', 'kt']),
});

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(formData);
  const field = (name: string) => formData.get(name) ?? undefined;
  const parsed = profileSchema.safeParse({
    display_name: field('display_name'),
    full_name: field('full_name'),
    country: String(field('country') ?? '').toUpperCase(),
    city: field('city'),
    home_site: field('home_site'),
    pilot_level: field('pilot_level') || null,
    flying_since: field('flying_since') === '' ? null : field('flying_since'),
    weight_kg: field('weight_kg') === '' ? null : field('weight_kg'),
    // Some keyboards type "12,5"; accept the comma.
    total_flight_hours:
      field('total_flight_hours') === ''
        ? 0
        : String(field('total_flight_hours') ?? '').replace(',', '.'),
    total_flights: field('total_flights') === '' ? 0 : field('total_flights'),
    wings: field('wings'),
    bio: field('bio'),
    field_privacy: {
      full_name: field('privacy_full_name'),
      photo: field('privacy_photo'),
      location: field('privacy_location'),
      home_site: field('privacy_home_site'),
      pilot_level: field('privacy_pilot_level'),
      years_flying: field('privacy_years_flying'),
      wings: field('privacy_wings'),
      bio: field('privacy_bio'),
      weight: field('privacy_weight'),
      flight_totals: field('privacy_flight_totals'),
    },
  });
  const prefs = preferencesSchema.safeParse({
    locale: field('pref_locale'),
    units_system: field('units_system'),
    units_speed: field('units_speed'),
  });
  const licence = licenceNumberSchema.safeParse(String(field('licence') ?? ''));
  const licenceBody = z
    .enum(LICENCE_BODIES)
    .nullable()
    .safeParse(field('licence_body') || null);
  if (!parsed.success || !prefs.success || !licence.success || !licenceBody.success) {
    // Name the exact field, so the form can mark it (privacy selects as privacy_<field>).
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      const [first, second] = issue.path;
      fieldErrors[first === 'field_privacy' ? `privacy_${String(second)}` : String(first)] =
        'validation';
    }
    for (const issue of prefs.error?.issues ?? []) {
      const key = String(issue.path[0]);
      fieldErrors[key === 'locale' ? 'pref_locale' : key] = 'validation';
    }
    if (!licence.success) fieldErrors.licence = 'validation';
    if (!licenceBody.success) fieldErrors.licence_body = 'validation';
    return { error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      ...parsed.data,
      locale: prefs.data.locale,
      units: { system: prefs.data.units_system, speed: prefs.data.units_speed },
    })
    .eq('id', user.id);
  if (error) return { error: 'generic' };

  // Only touch the encrypted licence number when the user typed something or cleared it.
  const licenceUpdate: { licence_body: string | null; licence_number_enc?: string | null } = {
    licence_body: licenceBody.data,
  };
  if (formData.get('licence_changed') === '1') {
    const value = licence.data;
    licenceUpdate.licence_number_enc = value
      ? encryptField(value, serverEnv().LICENCE_ENCRYPTION_KEY)
      : null;
  }
  const { error: licenceError } = await supabase
    .from('profile_private')
    .update(licenceUpdate)
    .eq('user_id', user.id);
  if (licenceError) return { error: 'generic' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setAvatar(path: string | null): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'generic' };
  if (path !== null && !path.startsWith(`${user.id}/`)) return { error: 'generic' };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .single();
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id);
  if (error) return { error: 'generic' };
  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from('avatars').remove([current.avatar_path]);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setConsent(formData: FormData): Promise<void> {
  const user = await requireUser(formData);
  const type = String(formData.get('consent_type')) as ConsentType;
  if (!CONSENT_TYPES.includes(type)) return;
  const supabase = await createClient();
  await supabase.from('consents').insert({
    user_id: user.id,
    consent_type: type,
    granted: formData.get('granted') === 'true',
    method: 'settings',
  });
  revalidatePath(`/${localeFrom(formData)}/account/privacy`);
}

const requestSchema = z.object({
  request_type: z.enum(['objection', 'rectification', 'restriction', 'access', 'other']),
  details: z.string().trim().max(4000).optional(),
});

export async function submitDataRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser(formData);
  const parsed = requestSchema.safeParse({
    request_type: formData.get('request_type'),
    details: formData.get('details') ?? undefined,
  });
  if (!parsed.success) return { error: 'validation' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('data_requests')
    .insert({
      user_id: user.id,
      requester_email: user.email ?? '',
      request_type: parsed.data.request_type,
      channel: 'in_app',
      details: parsed.data.details || null,
    })
    .select('due_at')
    .single();
  if (error) return { error: 'generic' };
  revalidatePath(`/${localeFrom(formData)}/account/privacy`);
  return { ok: true, values: { due: data.due_at } };
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await requireUser(formData);
  if (formData.get('confirm') !== 'on') return { error: 'validation' };
  const supabase = await createClient();

  // Storage objects are not removed by database cascades: delete them through the Storage API.
  await removeUserFiles(user.id);

  const { error } = await supabase.rpc('request_account_deletion');
  if (error && !error.message.includes('deletion_already_requested')) return { error: 'generic' };
  await supabase.auth.signOut({ scope: 'local' });
  redirect(`/${locale}/account-deleted`);
}
