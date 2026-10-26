import { z } from 'zod';
import { FLIGHT_VISIBILITIES } from './privacy';

export const EQUIPMENT_KINDS = [
  'wing',
  'harness',
  'reserve',
  'instrument',
  'helmet',
  'radio',
  'other',
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export const SITE_KINDS = ['launch', 'landing', 'both'] as const;
export const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Default intervals the app suggests (manufacturers differ: the user can change them). */
export const DEFAULT_INTERVALS_MONTHS: Partial<
  Record<EquipmentKind, { check?: number; repack?: number }>
> = {
  wing: { check: 24 },
  reserve: { repack: 12 },
  harness: { check: 24 },
};

/** Largest file the import accepts (bytes). Typical IGC files are 0.2–3 MB. */
export const MAX_TRACK_FILE_BYTES = 8 * 1024 * 1024;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().uuid().nullable(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
);

const optionalMonths = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(1).max(max).nullable(),
  );

export const manualFlightSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    hours: z.coerce.number().int().min(0).max(23),
    minutes: z.coerce.number().int().min(0).max(59),
    takeoff_site_id: optionalUuid,
    site_name: optionalText(120),
    glider: optionalText(120),
    wing_id: optionalUuid,
    visibility: z.enum(FLIGHT_VISIBILITIES),
    notes: optionalText(2000),
  })
  .refine((f) => f.hours * 60 + f.minutes > 0, { message: 'duration', path: ['minutes'] });

export const flightEditSchema = z.object({
  takeoff_site_id: optionalUuid,
  landing_site_id: optionalUuid,
  site_name: optionalText(120),
  glider: optionalText(120),
  wing_id: optionalUuid,
  visibility: z.enum(FLIGHT_VISIBILITIES),
  notes: optionalText(2000),
});

export const equipmentSchema = z.object({
  kind: z.enum(EQUIPMENT_KINDS),
  brand: optionalText(60),
  model: z.string().trim().min(1).max(80),
  size: optionalText(20),
  certification: optionalText(20),
  purchased_on: optionalDate,
  last_check_on: optionalDate,
  check_interval_months: optionalMonths(120),
  last_repack_on: optionalDate,
  repack_interval_months: optionalMonths(60),
  notes: optionalText(2000),
});

export const siteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  kind: z.enum(SITE_KINDS),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  elevation_m: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.coerce.number().int().min(-500).max(9000).nullable(),
  ),
  wind_directions: z.array(z.enum(WIND_DIRECTIONS)),
  region: optionalText(80),
  description: z.string().trim().max(5000),
  rules: z.string().trim().max(3000),
  verified: z.boolean(),
});

/** `YYYY-MM-DD` + months, or null when either is missing. */
export function nextDueDate(last: string | null | undefined, months: number | null | undefined) {
  if (!last || !months) return null;
  const [y, m, d] = last.split('-').map(Number) as [number, number, number];
  const due = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp to the month's last day (e.g. 31 Aug + 6 months → 28/29 Feb).
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  due.setUTCDate(Math.min(d, lastDay));
  return due.toISOString().slice(0, 10);
}

export type DueStatus = 'ok' | 'soon' | 'overdue';

/** "soon" = within 14 days, matching the database reminder job. */
export function dueStatus(due: string | null, today: string): DueStatus | null {
  if (!due) return null;
  if (due < today) return 'overdue';
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 14);
  return due < soon.toISOString().slice(0, 10) ? 'soon' : 'ok';
}

/** 5400 → "1:30". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** 42195 → "42.2 km", 850 → "850 m". */
export function formatDistance(metres: number | null | undefined, locale = 'tr'): string {
  if (metres === null || metres === undefined) return '–';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
}
