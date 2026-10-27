import { z } from 'zod';
import { PILOT_LEVELS, type PilotLevel } from './schemas';

/** Must match the trip_* enums in SQL. */
export const TRIP_STATUSES = ['draft', 'open', 'closed', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const TRIP_REGISTRATION_STATUSES = [
  'pending',
  'accepted',
  'waitlisted',
  'declined',
  'cancelled',
] as const;
export type TripRegistrationStatus = (typeof TRIP_REGISTRATION_STATUSES)[number];
export const TRIP_PAYMENT_STATUSES = ['unpaid', 'deposit_paid', 'paid', 'refunded'] as const;
export type TripPaymentStatus = (typeof TRIP_PAYMENT_STATUSES)[number];
export const TRIP_CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
/** Equipment an organiser can require; labels live in i18n (`trips.equipment.*`). */
export const TRIP_EQUIPMENT = [
  'reserve',
  'helmet',
  'radio',
  'harness_protector',
  'hook_knife',
  'first_aid',
  'vario',
  'live_tracker',
  'insurance',
  'licence',
] as const;

/** Same ranking as private.pilot_level_rank() in SQL. */
const LEVEL_RANK: Record<PilotLevel, number> = {
  student: 0,
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
  t1: 5,
  t2: 5,
  t3: 5,
  tandem: 5,
  instructor: 6,
};

export function pilotLevelRank(level: PilotLevel): number {
  return LEVEL_RANK[level];
}

export interface TripRequirements {
  min_pilot_level: PilotLevel | null;
  min_years_flying: number | null;
}

export interface PilotFacts {
  pilot_level: PilotLevel | null;
  /** Already worked out with yearsFlying(). */
  years_flying: number | null;
}

/** Which requirements a pilot misses, using the same rules the database enforces. */
export function missingRequirements(
  trip: TripRequirements,
  pilot: PilotFacts,
): ('level' | 'years')[] {
  const missing: ('level' | 'years')[] = [];
  if (
    trip.min_pilot_level &&
    (!pilot.pilot_level || pilotLevelRank(pilot.pilot_level) < pilotLevelRank(trip.min_pilot_level))
  )
    missing.push('level');
  if (trip.min_years_flying != null && (pilot.years_flying ?? 0) < trip.min_years_flying)
    missing.push('years');
  return missing;
}

export function seatsLeft(maxPilots: number, seatsTaken: number): number {
  return Math.max(0, maxPilots - seatsTaken);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);
const optionalInt = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable());
const optionalMoney = z.preprocess(
  (v) => (typeof v === 'string' ? emptyToNull(v.replace(',', '.')) : emptyToNull(v)),
  z.coerce.number().min(0).max(10_000_000).nullable(),
);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

/** Admin trip form. Multi-value fields (sites, guides, equipment) are parsed separately. */
export const tripSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    summary: optionalText(300),
    description_md: z.string().trim().max(20000),
    itinerary_md: z.string().trim().max(20000),
    destination_country: z.preprocess(
      (v) => (typeof v === 'string' ? emptyToNull(v.trim().toUpperCase()) : null),
      z
        .string()
        .regex(/^[A-Z]{2}$/)
        .nullable(),
    ),
    destination_region: optionalText(120),
    starts_on: date,
    ends_on: date,
    meeting_point: optionalText(200),
    meeting_at: z.preprocess(emptyToNull, localDateTime.nullable()),
    registration_opens_at: z.preprocess(emptyToNull, localDateTime.nullable()),
    registration_deadline: z.preprocess(emptyToNull, localDateTime.nullable()),
    max_pilots: z.coerce.number().int().min(1).max(500),
    min_pilots: optionalInt(1, 500),
    companions_allowed: checkbox,
    min_pilot_level: z.preprocess(emptyToNull, z.enum(PILOT_LEVELS).nullable()),
    min_years_flying: optionalInt(0, 80),
    min_flights: optionalInt(0, 100000),
    requirements_md: z.string().trim().max(5000),
    price_amount: optionalMoney,
    price_currency: z.enum(TRIP_CURRENCIES),
    deposit_amount: optionalMoney,
    payment_deadline: z.preprocess(emptyToNull, date.nullable()),
    payment_info_md: z.string().trim().max(3000),
    price_includes: optionalText(2000),
    price_excludes: optionalText(2000),
    cancellation_policy: optionalText(3000),
    accommodation: optionalText(2000),
    transport: optionalText(2000),
    members_only: checkbox,
    allow_minors: checkbox,
    auto_accept: checkbox,
    status: z.enum(TRIP_STATUSES),
  })
  .refine((t) => t.ends_on >= t.starts_on, { message: 'order', path: ['ends_on'] })
  .refine((t) => t.min_pilots == null || t.min_pilots <= t.max_pilots, {
    message: 'order',
    path: ['min_pilots'],
  })
  .refine(
    (t) => t.deposit_amount == null || t.price_amount == null || t.deposit_amount <= t.price_amount,
    { message: 'order', path: ['deposit_amount'] },
  )
  .refine(
    (t) =>
      !t.registration_opens_at ||
      !t.registration_deadline ||
      t.registration_deadline >= t.registration_opens_at,
    { message: 'order', path: ['registration_deadline'] },
  );
export type TripInput = z.infer<typeof tripSchema>;

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ()-]*$/)
  .transform((v) => (v === '' ? null : v));

export const tripRegistrationSchema = z.object({
  companions: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(5).nullable()),
  note: optionalText(500),
  phone,
  emergency_name: optionalText(100),
  emergency_phone: phone,
  confirm: z.literal('on'),
});
