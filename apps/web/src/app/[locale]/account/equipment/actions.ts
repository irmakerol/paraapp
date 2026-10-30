'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { equipmentSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

export async function saveEquipment(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'common.signInToContinue' };
  if (id && !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = equipmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const supabase = await createClient();
  const result = id
    ? await supabase
        .from('equipment')
        .update(parsed.data)
        .eq('id', id)
        .eq('user_id', viewer.user.id)
        .select('id')
        .single()
    : await supabase
        .from('equipment')
        .insert({ ...parsed.data, user_id: viewer.user.id })
        .select('id')
        .single();
  if (result.error) return { error: 'generic' };
  revalidatePath('/[locale]/logbook', 'layout');
  redirect(`/${localeFrom(formData)}/account/equipment`);
}

export async function setRetired(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase
    .from('equipment')
    .update({ retired: formData.get('retired') === 'true' })
    .eq('id', id)
    .eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/logbook', 'layout');
}

/** Marks today's check or repack as done. */
export async function markDone(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  const what = str(formData, 'what');
  if (!viewer || !uuid.safeParse(id).success || (what !== 'check' && what !== 'repack')) return;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  const supabase = await createClient();
  await supabase
    .from('equipment')
    .update(what === 'check' ? { last_check_on: today } : { last_repack_on: today })
    .eq('id', id)
    .eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/logbook', 'layout');
}

export async function deleteEquipment(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  // Flights that used this wing keep their glider text; the link becomes empty.
  await supabase.from('equipment').delete().eq('id', id).eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/logbook', 'layout');
  redirect(`/${localeFrom(formData)}/account/equipment`);
}
