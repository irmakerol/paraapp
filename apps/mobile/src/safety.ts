import { CONFIG } from './config';
import { supabase } from './supabase';

/** Must match INCIDENT_* in packages/core/src/safety.ts and the incident_* enums in SQL. */
export const INCIDENT_ANONYMITY = ['named', 'community_anonymous', 'fully_anonymous'] as const;
export type Anonymity = (typeof INCIDENT_ANONYMITY)[number];
export const INCIDENT_CATEGORIES = [
  'collapse',
  'spiral_or_spin',
  'reserve_deployment',
  'takeoff',
  'landing',
  'tree_landing',
  'water_landing',
  'collision',
  'power_line',
  'equipment_failure',
  'weather',
  'medical',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export const INCIDENT_SEVERITIES = ['near_miss', 'minor', 'serious', 'fatal'] as const;
export type Severity = (typeof INCIDENT_SEVERITIES)[number];
export const EMERGENCY_NUMBERS = [
  { key: 'emergency', number: '112' },
  { key: 'gendarmerie', number: '156' },
  { key: 'coastGuard', number: '158' },
] as const;
export const CLUB_EMAIL = 'info@flyanatolia.com';

export interface IncidentForm {
  anonymity: Anonymity;
  occurred_on: string;
  site_id: string | null;
  site_name: string;
  category: IncidentCategory;
  severity: Severity;
  injured: boolean;
  description: string;
  conditions: string;
  equipment: string;
  lessons: string;
  contact_ok: boolean;
  special_category_consent: boolean;
  injury_details: string;
}

export interface MyReport {
  id: string;
  occurredOn: string;
  category: IncidentCategory;
  status: 'submitted' | 'in_review' | 'closed';
  anonymity: Anonymity;
}

/** The person's own named and community-anonymous reports (fully anonymous ones are unlinked). */
export async function myReports(userId: string): Promise<MyReport[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('id, occurred_on, category, status, anonymity')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      occurred_on: string;
      category: IncidentCategory;
      status: MyReport['status'];
      anonymity: Anonymity;
    }[]
  ).map((r) => ({
    id: r.id,
    occurredOn: r.occurred_on,
    category: r.category,
    status: r.status,
    anonymity: r.anonymity,
  }));
}

export type SubmitResult = { ok: true } | { ok: false; error: string; fields: string[] };

/** Sent to the website, which keeps anonymity and encrypts injury details (see lib/incidents.ts). */
export async function submitIncident(form: IncidentForm): Promise<SubmitResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'unauthorized', fields: [] };
  const res = await fetch(`${CONFIG.webUrl}/api/mobile/incident`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...form,
      injury_details: form.injured && form.special_category_consent ? form.injury_details : '',
    }),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'offline', fields: [] };
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    fields?: string[];
  } | null;
  if (res.ok && body?.ok) return { ok: true };
  return { ok: false, error: body?.error ?? 'generic', fields: body?.fields ?? [] };
}
