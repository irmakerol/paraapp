import { z } from 'zod';

/** Must match the event_* / ride_* enums in SQL. */
export const EVENT_KINDS = [
  'club_trip',
  'course',
  'competition',
  'social',
  'meeting',
  'other',
] as const;
export const EVENT_STATUSES = ['draft', 'published', 'cancelled'] as const;
export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RIDE_KINDS = ['offer', 'request'] as const;
export const RIDE_PURPOSES = ['carpool', 'retrieve'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description_md: z.string().trim().max(10000),
    kind: z.enum(EVENT_KINDS),
    starts_at: localDateTime,
    ends_at: localDateTime,
    site_id: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.string().uuid().nullable(),
    ),
    location_text: optionalText(200),
    members_only: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
    capacity: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().int().min(1).max(10000).nullable(),
    ),
    rsvp_deadline: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      localDateTime.nullable(),
    ),
    status: z.enum(EVENT_STATUSES),
  })
  .refine((e) => e.ends_at >= e.starts_at, { message: 'order', path: ['ends_at'] });

export const rideSchema = z.object({
  kind: z.enum(RIDE_KINDS),
  purpose: z.enum(RIDE_PURPOSES),
  ride_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depart_time: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  ),
  from_text: z.string().trim().min(2).max(120),
  site_id: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().uuid().nullable(),
  ),
  to_text: optionalText(120),
  seats: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.coerce.number().int().min(1).max(8).nullable(),
  ),
  note: optionalText(1000),
});

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** RFC 5545 lines are folded at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (bytes(rest) > 75) {
    let cut = 75;
    while (bytes(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

/** A one-event iCalendar file (works with Google, Apple and Outlook calendars). */
export function toIcs(event: {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startsAt: string;
  endsAt: string;
  cancelled?: boolean;
  stamp?: string;
  /** startsAt/endsAt are YYYY-MM-DD dates (both inclusive), e.g. a multi-day trip. */
  allDay?: boolean;
}): string {
  const dayAfter = (d: string) => {
    const next = new Date(`${d}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10).replaceAll('-', '');
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ParaApp//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(event.stamp ?? new Date().toISOString())}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${event.startsAt.replaceAll('-', '')}`
      : `DTSTART:${icsDate(event.startsAt)}`,
    event.allDay ? `DTEND;VALUE=DATE:${dayAfter(event.endsAt)}` : `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : null,
    event.location ? `LOCATION:${icsEscape(event.location)}` : null,
    event.url ? `URL:${event.url}` : null,
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
