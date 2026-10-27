import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';
import type { Tables } from '@/lib/supabase/database.types';

export type Trip = Tables<'trips'>;

/** A trip the viewer may see (RLS decides), with its sites and guides in order. */
export const getTrip = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await createClient();
  const { data: trip } = await supabase.from('trips').select('*').eq('slug', slug).maybeSingle();
  if (!trip) return null;
  return { ...trip, ...(await tripExtras(trip.id)) };
});

export async function tripExtras(tripId: string) {
  const supabase = await createClient();
  const [{ data: sites }, { data: guides }] = await Promise.all([
    supabase
      .from('trip_sites')
      .select('position, sites:site_id(id, slug, name, lat, lng, region)')
      .eq('trip_id', tripId)
      .order('position'),
    supabase
      .from('trip_guides')
      .select('user_id, role_label, position')
      .eq('trip_id', tripId)
      .order('position'),
  ]);
  const names = await displayNames(
    supabase,
    (guides ?? []).map((g) => g.user_id),
  );
  return {
    sites: (sites ?? []).flatMap((s) => (s.sites ? [s.sites] : [])),
    guides: (guides ?? []).map((g) => ({
      id: g.user_id,
      name: names.get(g.user_id) ?? null,
      role: g.role_label,
    })),
  };
}

export function countryName(code: string | null, locale: string): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function tripDestination(
  trip: Pick<Trip, 'destination_region' | 'destination_country'>,
  locale: string,
): string | null {
  return (
    [trip.destination_region, countryName(trip.destination_country, locale)]
      .filter(Boolean)
      .join(', ') || null
  );
}

/** "1–4 May 2027" style range in the club's time zone (dates have no time). */
export function formatDateRange(start: string, end: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return start === end ? fmt.format(a) : fmt.formatRange(a, b);
}

export function tripDays(start: string, end: string): number {
  return (
    Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

/** Registration is open now (the database checks the same rules). */
export function registrationOpen(trip: Trip, now: number, today: string): boolean {
  return (
    trip.status === 'open' &&
    trip.starts_on >= today &&
    (!trip.registration_opens_at || new Date(trip.registration_opens_at).getTime() <= now) &&
    (!trip.registration_deadline || new Date(trip.registration_deadline).getTime() >= now)
  );
}
