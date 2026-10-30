import { z } from 'zod';
import { parseIsoDate } from './age';
import { VISIBILITIES, PRIVATE_PROFILE_FIELDS } from './privacy';

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(128);
export const isoDateSchema = z
  .string()
  .refine((v) => parseIsoDate(v) !== null, { message: 'invalid_date' });

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const PILOT_LEVELS = [
  'student',
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  't1',
  't2',
  't3',
  'tandem',
  'instructor',
] as const;
export type PilotLevel = (typeof PILOT_LEVELS)[number];
/**
 * Levels offered in forms (the club's list, 2026-10-27); older values stay valid for old data.
 * "Instructor" is a separate tick box (`profiles.is_instructor`) since 2026-10-30.
 */
export const PILOT_LEVEL_CHOICES = ['p2', 'p3', 'p4', 'p5', 't1', 't2', 't3'] as const;

/** Position in the forms' order: P2 < P3 < P4 < P5 < T1 < T2 < T3. Must match private.level_order. */
const LEVEL_ORDER: Record<PilotLevel, number> = {
  student: 0,
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
  t1: 6,
  tandem: 6,
  t2: 7,
  t3: 8,
  instructor: 9,
};

/**
 * Levels a student pilot can be training for: only those above their current level
 * (all of them when no level is set). Must match private.training_level_ok.
 */
export function trainingLevelOptions(
  current: string | null | undefined,
): (typeof PILOT_LEVEL_CHOICES)[number][] {
  const floor = current && current in LEVEL_ORDER ? LEVEL_ORDER[current as PilotLevel] : -1;
  return PILOT_LEVEL_CHOICES.filter((l) => LEVEL_ORDER[l] > floor);
}

export const trainingLevelSchema = z.enum(PILOT_LEVEL_CHOICES).nullable();

/** Years flying from the year a pilot started (falls back to the older "years flying" number). */
export function yearsFlying(
  p: { flying_since?: number | null; years_flying?: number | null },
  now: Date,
): number | null {
  if (p.flying_since != null) return Math.max(0, now.getFullYear() - p.flying_since);
  return p.years_flying ?? null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const visibilitySchema = z.enum(VISIBILITIES);

export const fieldPrivacySchema = z.object(
  Object.fromEntries(PRIVATE_PROFILE_FIELDS.map((f) => [f, visibilitySchema])) as Record<
    (typeof PRIVATE_PROFILE_FIELDS)[number],
    typeof visibilitySchema
  >,
);

export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(40),
  full_name: optionalText(100),
  country: optionalText(2),
  city: optionalText(80),
  home_site: optionalText(120),
  pilot_level: z.enum(PILOT_LEVELS).nullable().optional(),
  flying_since: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
  weight_kg: z.coerce.number().int().min(30).max(250).nullable().optional(),
  total_flight_hours: z.coerce
    .number()
    .min(0)
    .max(100000)
    .transform((h) => Math.round(h * 10) / 10)
    .optional(),
  total_flights: z.coerce.number().int().min(0).max(1000000).optional(),
  wings: optionalText(200),
  bio: optionalText(500),
  field_privacy: fieldPrivacySchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const licenceNumberSchema = z.string().trim().max(40);

export const guardianSchema = z.object({
  guardian_name: z.string().trim().min(2).max(100),
  guardian_email: emailSchema,
});

/** Bodies that issue paragliding licences, offered next to the licence number. Must match SQL. */
export const LICENCE_BODIES = ['thk', 'appi', 'ushpa', 'bhpa', 'ffvl', 'dhv', 'other'] as const;
export type LicenceBody = (typeof LICENCE_BODIES)[number];

/** Countries offered in the profile (ISO 3166-1 alpha-2); names come from Intl.DisplayNames. */
export const PROFILE_COUNTRIES = [
  'TR',
  'DE',
  'GB',
  'NL',
  'FR',
  'CH',
  'AT',
  'IT',
  'ES',
  'GR',
  'BG',
  'CY',
  'BE',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'RO',
  'HU',
  'PT',
  'IE',
  'AZ',
  'GE',
  'UA',
  'RU',
  'IR',
  'IL',
  'AE',
  'US',
  'CA',
  'AU',
  'NZ',
  'BR',
  'JP',
  'KR',
  'IN',
  'ZA',
] as const;
