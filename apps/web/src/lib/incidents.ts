import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncidentInput } from '@paraapp/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { sendPush } from '@/lib/push';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Files an incident report (website form and phone app). Named and community-anonymous reports
 * are written with the reporter's own session (RLS checks the id). Fully anonymous reports are
 * written with the service role and no user id at all, so nothing in the database links them to
 * the reporter. Returns an error key, or null when filed.
 */
export async function fileIncident(
  userClient: SupabaseClient<Database>,
  userId: string,
  input: IncidentInput,
): Promise<string | null> {
  const { injury_details, ...report } = input;
  const key = serverEnv().INCIDENT_ENCRYPTION_KEY;
  if (injury_details && !key) return 'safety.report.encryptionMissing';

  const anonymous = report.anonymity === 'fully_anonymous';
  const client = anonymous ? createAdminClient() : userClient;
  const { data, error } = await client
    .from('incident_reports')
    .insert({ ...report, reporter_id: anonymous ? null : userId })
    .select('id')
    .single();
  if (error) return 'generic';

  if (injury_details && key) {
    const { error: injuryError } = await client.rpc('add_incident_injury', {
      p_incident: data.id,
      p_details_enc: encryptField(injury_details, key),
    });
    if (injuryError) return 'generic';
    if (!anonymous) {
      // Record the explicit consent like any other consent (append-only).
      await client.from('consents').insert({
        user_id: userId,
        consent_type: 'incident_special_category',
        granted: true,
        method: 'feature_prompt',
      });
    }
  }

  await notifySafetyOfficers();
  return null;
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
