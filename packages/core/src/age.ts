import { APP_CONFIG } from './config';

export type AgeGroup = 'too_young' | 'minor' | 'adult';

/** Parses an ISO `YYYY-MM-DD` date into its parts, or null if invalid. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Full years between `birthDate` and `today` (both `YYYY-MM-DD`). */
export function ageOn(birthDate: string, today: string): number {
  const b = parseIsoDate(birthDate);
  const t = parseIsoDate(today);
  if (!b || !t) throw new Error('Invalid date');
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
  return age;
}

export function ageGroup(birthDate: string, today: string): AgeGroup {
  const age = ageOn(birthDate, today);
  if (age < APP_CONFIG.minimumAge) return 'too_young';
  if (age < APP_CONFIG.adultAge) return 'minor';
  return 'adult';
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
