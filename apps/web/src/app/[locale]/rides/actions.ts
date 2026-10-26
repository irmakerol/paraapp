'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rideSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { str } from '@/lib/form';
import { istanbulToday } from '@/lib/format';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

export async function postRide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'generic' };
  if (viewer.profile.age_group !== 'adult') return { error: 'rides.adultsOnly' };
  const parsed = rideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.ride_date < istanbulToday()) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? [])
      fieldErrors[String(issue.path[0])] = 'validation';
    if (parsed.success) fieldErrors.ride_date = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('rides')
    .insert({ ...parsed.data, user_id: viewer.user.id });
  if (error) return { error: 'generic' };
  revalidatePath('/[locale]/rides', 'page');
  return { ok: true };
}

/** Close or reopen your own post (RLS: owner only). */
export async function setRideClosed(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase
    .from('rides')
    .update({ closed: str(formData, 'closed') === '1' })
    .eq('id', id)
    .eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/rides', 'page');
}

export async function deleteRide(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from('rides').delete().eq('id', id).eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/rides', 'page');
}
