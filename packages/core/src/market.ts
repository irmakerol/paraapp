import { z } from 'zod';

export const AD_CATEGORIES = [
  'wing',
  'harness',
  'reserve',
  'instrument',
  'helmet',
  'radio',
  'clothing',
  'accessories',
  'other',
] as const;
export type AdCategory = (typeof AD_CATEGORIES)[number];

export const AD_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'for_parts'] as const;
export const AD_STATUSES = ['active', 'reserved', 'sold', 'archived'] as const;
export const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
export const MAX_AD_PHOTOS = 8;
export const AD_LIFETIME_DAYS = 60;

/** Wings and reserves get the "have it checked by a certified workshop" notice. */
export function needsSafetyNotice(category: AdCategory): boolean {
  return category === 'wing' || category === 'reserve';
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(min).max(max).nullable(),
  );

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(min).max(max).nullable(),
  );

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
);

export const adSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    category: z.enum(AD_CATEGORIES),
    brand: optionalText(60),
    model: optionalText(80),
    size: optionalText(20),
    weight_min: optionalInt(20, 300),
    weight_max: optionalInt(20, 300),
    year: optionalInt(1980, 2100),
    hours: optionalNumber(0, 99999),
    flights: optionalInt(0, 1_000_000),
    certification: optionalText(20),
    last_check_date: optionalDate,
    reserve_repack_date: optionalDate,
    condition: z.enum(AD_CONDITIONS),
    price: z.coerce.number().min(0).max(10_000_000),
    currency: z.enum(CURRENCIES),
    city: optionalText(80),
    location_text: optionalText(120),
    description: z.string().trim().max(5000),
  })
  .refine((a) => a.weight_min == null || a.weight_max == null || a.weight_min <= a.weight_max, {
    message: 'weight_range',
    path: ['weight_max'],
  });

export type AdInput = z.infer<typeof adSchema>;

export const adFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(AD_CATEGORIES).optional(),
  brand: z.string().trim().max(60).optional(),
  size: z.string().trim().max(20).optional(),
  certification: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});
export type AdFilters = z.infer<typeof adFiltersSchema>;

/** Parses URL search params, silently dropping anything invalid. */
export function parseAdFilters(params: Record<string, string | string[] | undefined>): AdFilters {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(adFiltersSchema.shape) as (keyof AdFilters)[]) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === '') continue;
    const parsed = adFiltersSchema.shape[key].safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as AdFilters;
}
