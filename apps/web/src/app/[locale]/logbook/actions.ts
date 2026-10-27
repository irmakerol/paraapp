'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { flightEditSchema, manualFlightSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { importTrack, type ImportResult } from '@/lib/flight-import';
import { localeFrom, str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

/** One file per call so the browser can show progress for a batch. */
export async function importFlight(formData: FormData): Promise<ImportResult> {
  const viewer = await getViewer();
  if (!viewer || (await getOnboardingStep(viewer))) return { ok: false, error: 'generic' };
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'unsupported' };
  const result = await importTrack(viewer, file);
  if (result.ok) revalidatePath('/[locale]/logbook', 'page');
  return result;
}

/** "Add these flights to my totals?" (asked after an import; the tracker will ask the same). */
export async function addFlightsToTotals(ids: string[]): Promise<number | null> {
  const viewer = await getViewer();
  const valid = ids.filter((id) => uuid.safeParse(id).success).slice(0, 500);
  if (!viewer || !valid.length) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_flights_to_totals', { p_flights: valid });
  if (error) return null;
  revalidatePath('/[locale]/account', 'layout');
  return data;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] = 'validation';
  return out;
}

/**
 * Equipment is private, so other people cannot see which wing a flight used. Copy the wing's
 * name into the public glider text when the pilot left that empty.
 */
async function gliderText(wingId: string | null | undefined, glider: string | null | undefined) {
  if (glider || !wingId) return glider ?? null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('equipment')
    .select('brand, model, size')
    .eq('id', wingId)
    .maybeSingle();
  return data ? [data.brand, data.model, data.size].filter(Boolean).join(' ') : null;
}

export async function addManualFlight(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'common.signInToContinue' };
  const parsed = manualFlightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const f = parsed.data;
  // Times are entered in Türkiye time (UTC+3, no DST).
  const startedAt = new Date(`${f.date}T${f.time}:00+03:00`);
  if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > Date.now() + 86400_000) {
    return { error: 'validation', fieldErrors: { date: 'validation' } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('flights')
    .insert({
      user_id: viewer.user.id,
      started_at: startedAt.toISOString(),
      duration_s: (f.hours * 60 + f.minutes) * 60,
      takeoff_site_id: f.takeoff_site_id,
      site_name: f.takeoff_site_id ? null : f.site_name,
      glider: await gliderText(f.wing_id, f.glider),
      wing_id: f.wing_id,
      visibility: f.visibility,
      notes: f.notes,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) return { error: 'generic' };
  if (str(formData, 'add_to_totals') === 'on')
    await supabase.rpc('add_flights_to_totals', { p_flights: [data.id] });
  revalidatePath('/[locale]/logbook', 'page');
  redirect(`/${localeFrom(formData)}/flights/${data.id}`);
}

export async function updateFlight(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !uuid.safeParse(id).success) return { error: 'generic' };
  const parsed = flightEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'validation', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from('flights')
    .update({ ...parsed.data, glider: await gliderText(parsed.data.wing_id, parsed.data.glider) })
    .eq('id', id)
    .eq('user_id', viewer.user.id);
  if (error) return { error: 'generic' };
  revalidatePath(`/[locale]/flights/${id}`, 'page');
  revalidatePath('/[locale]/logbook', 'page');
  return { ok: true };
}

export async function deleteFlight(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  if (!viewer || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from('flights')
    .select('file_path')
    .eq('id', id)
    .eq('user_id', viewer.user.id)
    .maybeSingle();
  if (!data) return;
  if (data.file_path) await supabase.storage.from('flight-files').remove([data.file_path]);
  await supabase.from('flights').delete().eq('id', id).eq('user_id', viewer.user.id);
  revalidatePath('/[locale]/logbook', 'page');
  redirect(`/${localeFrom(formData)}/logbook`);
}
