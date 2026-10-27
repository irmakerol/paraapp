'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { tripRegistrationSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** Database exception names that have their own message under `trips.errors`. */
const KNOWN_ERRORS = [
  'registration_closed',
  'adults_only',
  'no_companions',
  'requirements_not_met',
  'already_registered',
  'declined',
  'not_registered',
  'trip_full',
] as const;

function errorKey(message: string | undefined): string {
  const known = KNOWN_ERRORS.find((k) => message?.includes(k));
  return known ? `trips.errors.${known}` : 'generic';
}

function refresh() {
  revalidatePath('/[locale]/trips', 'layout');
}

export async function toggleInterest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const tripId = str(formData, 'trip_id');
  if (!uuid.safeParse(tripId).success) return { error: 'generic' };
  const supabase = await createClient();
  const { error } =
    str(formData, 'interested') === '1'
      ? await supabase.from('trip_interests').delete().eq('trip_id', tripId).eq('user_id', user.id)
      : await supabase.from('trip_interests').insert({ trip_id: tripId, user_id: user.id });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return { ok: true };
}

export async function registerForTrip(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const tripId = str(formData, 'trip_id');
  if (!uuid.safeParse(tripId).success) return { error: 'generic' };
  const parsed = tripRegistrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] =
        issue.path[0] === 'confirm' ? 'trips.confirmRequired' : 'validation';
    return { error: 'validation', fieldErrors };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('register_for_trip', {
    p_trip: tripId,
    p_companions: d.companions ?? 0,
    p_note: d.note ?? null,
    p_phone: d.phone,
    p_emergency_name: d.emergency_name ?? null,
    p_emergency_phone: d.emergency_phone,
  });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return { ok: true, values: { status: data } };
}

export async function updateRegistration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const tripId = str(formData, 'trip_id');
  if (!uuid.safeParse(tripId).success) return { error: 'generic' };
  const parsed = tripRegistrationSchema
    .omit({ confirm: true, companions: true })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_trip_registration', {
    p_trip: tripId,
    p_note: d.note ?? null,
    p_phone: d.phone,
    p_emergency_name: d.emergency_name ?? null,
    p_emergency_phone: d.emergency_phone,
  });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return { ok: true };
}

export async function cancelRegistration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const tripId = str(formData, 'trip_id');
  if (!uuid.safeParse(tripId).success) return { error: 'generic' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_trip_registration', { p_trip: tripId });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return { ok: true };
}
