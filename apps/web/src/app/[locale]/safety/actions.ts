'use server';
import { redirect } from 'next/navigation';
import { incidentSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { localeFrom } from '@/lib/form';
import { fileIncident } from '@/lib/incidents';
import type { ActionState } from '@/lib/action-state';

/** Files an incident report (see `fileIncident` for how anonymity is kept). */
export async function submitIncident(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || (await getOnboardingStep(viewer))) return { error: 'common.signInToContinue' };
  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const error = await fileIncident(await createClient(), viewer.user.id, parsed.data);
  if (error) return { error };
  redirect(`/${localeFrom(formData)}/safety?sent=1`);
}
