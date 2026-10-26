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
  'tandem',
  'instructor',
] as const;

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
  years_flying: z.coerce.number().int().min(0).max(80).nullable().optional(),
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
