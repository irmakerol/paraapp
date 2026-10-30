import { z } from 'zod';
import { CURRENCIES } from './market';

/** Must match the notice_kind / notice_category enums in SQL. */
export const NOTICE_KINDS = ['offer', 'request'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export const NOTICE_CATEGORIES = [
  'transport',
  'gear',
  'buddy',
  'training',
  'lost_found',
  'other',
] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];
/** Notices close themselves after this many days unless renewed. */
export const NOTICE_DAYS = 30;

const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional().default(null),
  );

export const noticeSchema = z
  .object({
    kind: z.enum(NOTICE_KINDS),
    category: z.enum(NOTICE_CATEGORIES),
    title: z.string().trim().min(3).max(120),
    body: optionalText(2000),
    site_id: z.preprocess(blankToNull, z.string().uuid().nullable()),
    place_text: optionalText(120),
    notice_date: z.preprocess(
      blankToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    ),
    seats: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(8).nullable()),
    price: z.preprocess(
      (v) => (typeof v === 'string' ? blankToNull(v.replace(',', '.').trim()) : blankToNull(v)),
      z.coerce.number().min(0).max(10_000_000).nullable(),
    ),
    currency: z.preprocess(blankToNull, z.enum(CURRENCIES).nullable()),
  })
  .transform((n) => ({
    ...n,
    // Seats only make sense for transport; a currency only with a price.
    seats: n.category === 'transport' ? n.seats : null,
    currency: n.price == null ? null : (n.currency ?? 'TRY'),
  }));

export type NoticeInput = z.infer<typeof noticeSchema>;

export const noticeFiltersSchema = z.object({
  category: z.enum(NOTICE_CATEGORIES).optional().catch(undefined),
  kind: z.enum(NOTICE_KINDS).optional().catch(undefined),
  site: z.string().uuid().optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export function parseNoticeFilters(
  params: Record<string, string | string[] | undefined>,
): z.infer<typeof noticeFiltersSchema> {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return noticeFiltersSchema.parse(flat);
}
