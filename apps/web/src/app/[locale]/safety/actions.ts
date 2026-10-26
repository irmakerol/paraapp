'use server';
import { redirect } from 'next/navigation';
import { incidentSchema } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { encryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { localeFrom } from '@/lib/form';
import { sendPush } from '@/lib/push';
import type { ActionState } from '@/lib/action-state';

/**
 * Files an incident report. Named and community-anonymous reports are written with the
 * reporter's own session (RLS checks the id). Fully anonymous reports are written with the
 * service role and no user id at all, so nothing in the database links them to the reporter.
 */
export async function submitIncident(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || (await getOnboardingStep(viewer))) return { error: 'common.signInToContinue' };
  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const { injury_details, ...report } = parsed.data;
  const key = serverEnv().INCIDENT_ENCRYPTION_KEY;
  if (injury_details && !key) return { error: 'safety.report.encryptionMissing' };

  const anonymous = report.anonymity === 'fully_anonymous';
  const client = anonymous ? createAdminClient() : await createClient();
  const { data, error } = await client
    .from('incident_reports')
    .insert({ ...report, reporter_id: anonymous ? null : viewer.user.id })
    .select('id')
    .single();
  if (error) return { error: 'generic' };

  if (injury_details && key) {
    const { error: injuryError } = await client.rpc('add_incident_injury', {
      p_incident: data.id,
      p_details_enc: encryptField(injury_details, key),
    });
    if (injuryError) return { error: 'generic' };
    if (!anonymous) {
      // Record the explicit consent like any other consent (append-only).
      await client.from('consents').insert({
        user_id: viewer.user.id,
        consent_type: 'incident_special_category',
        granted: true,
        method: 'feature_prompt',
      });
    }
  }

  await notifySafetyOfficers();
  redirect(`/${localeFrom(formData)}/safety?sent=1`);
}

/** Tells safety officers a report arrived. The push says nothing about its content. */
async function notifySafetyOfficers() {
  const admin = createAdminClient();
  const { data } = await admin.from('user_roles').select('user_id').eq('role', 'safety_officer');
  const officers = (data ?? []).map((r) => r.user_id);
  if (!officers.length) return;
  await sendPush(officers, 'safety', (t, locale) => ({
    title: t('incidentTitle'),
    body: t('incidentBody'),
    url: `/${locale}/admin/safety`,
    tag: 'incident-new',
  }));
}
