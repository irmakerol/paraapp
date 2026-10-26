/** Date formatting in the Türkiye time zone, which the club works in. */
const TIME_ZONE = 'Europe/Istanbul';

export function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: TIME_ZONE }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** `datetime-local` input value (Istanbul time) → ISO string with offset. Türkiye is UTC+3. */
export function istanbulLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00+03:00`).toISOString();
}

/** ISO string → `datetime-local` value in Istanbul time. */
export function isoToIstanbulLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(new Date(value).getTime() + 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** The current time, for server components that compare dates while rendering. */
export function currentTime(): number {
  return Date.now();
}

/** Today's date in Istanbul, as YYYY-MM-DD. */
export function istanbulToday(): string {
  return isoToIstanbulLocal(new Date(currentTime()).toISOString()).slice(0, 10);
}

/** A date-only value (YYYY-MM-DD) as a long local date, e.g. "Sunday, 1 November". */
export function formatDay(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
