import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { listSites } from '@/lib/sites';
import { isoToIstanbulLocal } from '@/lib/format';
import type { Trip } from '@/lib/trips';
import type { TripValues } from './trip-form';

/** Sites and the people who can guide (club members and staff). */
export async function tripFormOptions() {
  const supabase = await createClient();
  const [sites, { data: people }] = await Promise.all([
    listSites(),
    supabase
      .from('profile_cards')
      .select('id, display_name')
      .eq('is_member', true)
      .order('display_name')
      .limit(500),
  ]);
  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name, region: s.region })),
    people: (people ?? []).map((p) => ({ id: p.id!, name: p.display_name! })),
  };
}

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));

export function tripValues(
  trip: Trip | null,
  siteIds: string[] = [],
  guides: { id: string; role: string }[] = [],
): TripValues {
  return {
    title: str(trip?.title),
    summary: str(trip?.summary),
    description_md: str(trip?.description_md),
    itinerary_md: str(trip?.itinerary_md),
    cover_path: str(trip?.cover_path),
    destination_country: trip ? str(trip.destination_country) : 'TR',
    destination_region: str(trip?.destination_region),
    starts_on: str(trip?.starts_on),
    ends_on: str(trip?.ends_on),
    meeting_point: str(trip?.meeting_point),
    meeting_at: isoToIstanbulLocal(trip?.meeting_at),
    registration_opens_at: isoToIstanbulLocal(trip?.registration_opens_at),
    registration_deadline: isoToIstanbulLocal(trip?.registration_deadline),
    max_pilots: trip ? str(trip.max_pilots) : '12',
    min_pilots: str(trip?.min_pilots),
    companions_allowed: trip?.companions_allowed ?? false,
    min_pilot_level: str(trip?.min_pilot_level),
    min_years_flying: str(trip?.min_years_flying),
    min_flights: str(trip?.min_flights),
    required_equipment: trip?.required_equipment ?? ['reserve', 'helmet', 'radio'],
    requirements_md: str(trip?.requirements_md),
    price_amount: str(trip?.price_amount),
    price_currency: trip?.price_currency ?? 'TRY',
    deposit_amount: str(trip?.deposit_amount),
    payment_deadline: str(trip?.payment_deadline),
    payment_info_md: str(trip?.payment_info_md),
    price_includes: str(trip?.price_includes),
    price_excludes: str(trip?.price_excludes),
    cancellation_policy: str(trip?.cancellation_policy),
    accommodation: str(trip?.accommodation),
    transport: str(trip?.transport),
    members_only: trip?.members_only ?? false,
    allow_minors: trip?.allow_minors ?? false,
    auto_accept: trip?.auto_accept ?? false,
    status: trip?.status ?? 'draft',
    site_ids: siteIds,
    guides,
  };
}
