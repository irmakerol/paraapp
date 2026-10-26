import { z } from 'zod';

/** Must match the incident_* enums in SQL. */
export const INCIDENT_ANONYMITY = ['named', 'community_anonymous', 'fully_anonymous'] as const;
export type IncidentAnonymity = (typeof INCIDENT_ANONYMITY)[number];

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
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = ['submitted', 'in_review', 'closed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const incidentSchema = z
  .object({
    anonymity: z.enum(INCIDENT_ANONYMITY),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    site_id: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.string().uuid().nullable(),
    ),
    site_name: optionalText(120),
    category: z.enum(INCIDENT_CATEGORIES),
    severity: z.enum(INCIDENT_SEVERITIES),
    injured: checkbox,
    description: z.string().trim().min(20).max(8000),
    conditions: optionalText(2000),
    equipment: optionalText(500),
    lessons: optionalText(4000),
    contact_ok: checkbox,
    special_category_consent: checkbox,
    injury_details: optionalText(4000),
  })
  // Health data only with explicit consent; contact only when the reporter is known.
  .refine((r) => !r.injury_details || r.special_category_consent, {
    message: 'consent',
    path: ['special_category_consent'],
  })
  .transform((r) => ({
    ...r,
    contact_ok: r.anonymity === 'fully_anonymous' ? false : r.contact_ok,
    injury_details: r.special_category_consent ? r.injury_details : null,
  }));
export type IncidentInput = z.infer<typeof incidentSchema>;

export const lessonSchema = z.object({
  title: z.string().trim().min(5).max(160),
  locale: z.enum(['tr', 'en']),
  summary: optionalText(400),
  body_md: z.string().trim().min(1).max(20000),
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(INCIDENT_SEVERITIES),
  status: z.enum(['draft', 'published']),
});

/** Emergency numbers shown on the SOS screen (Türkiye). */
export const EMERGENCY_NUMBERS = [
  { key: 'emergency', number: '112' },
  { key: 'gendarmerie', number: '156' },
  { key: 'coastGuard', number: '158' },
] as const;

/** Google/Apple maps-independent link to a position (OpenStreetMap). */
export function osmLink(lat: number, lng: number, zoom = 15): string {
  const la = lat.toFixed(5);
  const ln = lng.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=${zoom}/${la}/${ln}`;
}

/** 36.55231, 29.16190 → `36°33'08.3"N 29°09'42.8"E` (what rescue services often ask for). */
export function toDms(lat: number, lng: number): string {
  const part = (value: number, pos: string, neg: string) => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(1).padStart(4, '0')}"${value >= 0 ? pos : neg}`;
  };
  return `${part(lat, 'N', 'S')} ${part(lng, 'E', 'W')}`;
}
