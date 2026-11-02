import { locale } from './i18n';
import { supabase } from './supabase';
import { displayNames, publicUrl, sample } from './content';

// Club trips. Reading goes through RLS; registering, editing and cancelling only through the
// database's definer functions (seats, the waiting list and notifications are handled there).

export type RegistrationStatus = 'pending' | 'accepted' | 'waitlisted' | 'declined' | 'cancelled';

export interface TripItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover: string | null;
  startsOn: string;
  endsOn: string;
  destination: string | null;
  price: number | null;
  currency: string;
  status: string;
  membersOnly: boolean;
  minLevel: string | null;
}

export interface Registration {
  status: RegistrationStatus;
  note: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  payment: string;
}

export interface TripDetail extends TripItem {
  description: string;
  itinerary: string;
  requirements: string;
  paymentInfo: string;
  maxPilots: number;
  minPilots: number | null;
  companionsAllowed: boolean;
  allowMinors: boolean;
  minYears: number | null;
  minFlights: number | null;
  equipment: string[];
  deposit: number | null;
  paymentDeadline: string | null;
  includes: string | null;
  excludes: string | null;
  cancellation: string | null;
  accommodation: string | null;
  transport: string | null;
  meetingPoint: string | null;
  meetingAt: string | null;
  opensAt: string | null;
  deadline: string | null;
  sites: { id: string; name: string; region: string | null }[];
  guides: { id: string; name: string | null; role: string | null }[];
  seatsLeft: number;
  waitlisted: number;
  interestedCount: number;
  mine: Registration | null;
  interested: boolean;
}

const LIST_FIELDS =
  'id, slug, title, summary, cover_path, starts_on, ends_on, destination_country, destination_region, price_amount, price_currency, status, members_only, min_pilot_level';

interface TripRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_path: string | null;
  starts_on: string;
  ends_on: string;
  destination_country: string | null;
  destination_region: string | null;
  price_amount: number | null;
  price_currency: string;
  status: string;
  members_only: boolean;
  min_pilot_level: string | null;
}

function country(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const item = (r: TripRow): TripItem => ({
  id: r.id,
  slug: r.slug,
  title: sample(r.title),
  summary: r.summary,
  cover: publicUrl('content', r.cover_path),
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  destination:
    [r.destination_region, country(r.destination_country)].filter(Boolean).join(', ') || null,
  price: r.price_amount,
  currency: r.price_currency,
  status: r.status,
  membersOnly: r.members_only,
  minLevel: r.min_pilot_level,
});

/** Istanbul's date today (trips are dated in the club's time zone). */
export function istanbulToday(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

export async function listTrips(view: 'upcoming' | 'past' | 'mine'): Promise<TripItem[]> {
  if (view === 'mine') {
    const { data: session } = await supabase.auth.getSession();
    const me = session.session?.user.id;
    if (!me) return [];
    const [regs, interests] = await Promise.all([
      supabase
        .from('trip_registrations')
        .select('trip_id')
        .eq('user_id', me)
        .not('status', 'in', '(cancelled)'),
      supabase.from('trip_interests').select('trip_id').eq('user_id', me),
    ]);
    const ids = [
      ...new Set(
        [...(regs.data ?? []), ...(interests.data ?? [])].map(
          (r) => (r as { trip_id: string }).trip_id,
        ),
      ),
    ];
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('trips')
      .select(LIST_FIELDS)
      .in('id', ids)
      .order('starts_on');
    if (error) throw error;
    return ((data ?? []) as TripRow[]).map(item);
  }
  const today = istanbulToday();
  let query = supabase.from('trips').select(LIST_FIELDS).neq('status', 'draft').limit(100);
  query =
    view === 'past'
      ? query.lt('ends_on', today).order('starts_on', { ascending: false })
      : query.gte('ends_on', today).order('starts_on');
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as TripRow[]).map(item);
}

export async function loadTrip(id: string): Promise<TripDetail | null> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id ?? null;
  const { data } = await supabase
    .from('trips')
    .select(
      '*, trip_sites(position, sites:site_id(id, name, region)), trip_guides(user_id, role_label, position)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const t = data as unknown as TripRow & {
    description_md: string;
    itinerary_md: string;
    requirements_md: string;
    payment_info_md: string;
    max_pilots: number;
    min_pilots: number | null;
    companions_allowed: boolean;
    allow_minors: boolean;
    min_years_flying: number | null;
    min_flights: number | null;
    required_equipment: string[];
    deposit_amount: number | null;
    payment_deadline: string | null;
    price_includes: string | null;
    price_excludes: string | null;
    cancellation_policy: string | null;
    accommodation: string | null;
    transport: string | null;
    meeting_point: string | null;
    meeting_at: string | null;
    registration_opens_at: string | null;
    registration_deadline: string | null;
    trip_sites:
      | { position: number; sites: { id: string; name: string; region: string | null } | null }[]
      | null;
    trip_guides: { user_id: string; role_label: string | null; position: number }[] | null;
  };
  const [{ data: counts }, mine, interest] = await Promise.all([
    supabase.rpc('trip_counts', { p_trip: id }),
    me
      ? supabase
          .from('trip_registrations')
          .select('status, note, phone, emergency_name, emergency_phone, payment_status')
          .eq('trip_id', id)
          .eq('user_id', me)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    me
      ? supabase
          .from('trip_interests')
          .select('trip_id')
          .eq('trip_id', id)
          .eq('user_id', me)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const c = (
    (counts ?? []) as { seats_taken: number; waitlisted: number; interested: number }[]
  )[0];
  const guides = [...(t.trip_guides ?? [])].sort((a, b) => a.position - b.position);
  const names = await displayNames(guides.map((g) => g.user_id));
  const m = mine.data as {
    status: RegistrationStatus;
    note: string | null;
    phone: string | null;
    emergency_name: string | null;
    emergency_phone: string | null;
    payment_status: string;
  } | null;
  return {
    ...item(t),
    description: t.description_md,
    itinerary: t.itinerary_md,
    requirements: t.requirements_md,
    paymentInfo: t.payment_info_md,
    maxPilots: t.max_pilots,
    minPilots: t.min_pilots,
    companionsAllowed: t.companions_allowed,
    allowMinors: t.allow_minors,
    minYears: t.min_years_flying,
    minFlights: t.min_flights,
    equipment: t.required_equipment ?? [],
    deposit: t.deposit_amount,
    paymentDeadline: t.payment_deadline,
    includes: t.price_includes,
    excludes: t.price_excludes,
    cancellation: t.cancellation_policy,
    accommodation: t.accommodation,
    transport: t.transport,
    meetingPoint: t.meeting_point,
    meetingAt: t.meeting_at,
    opensAt: t.registration_opens_at,
    deadline: t.registration_deadline,
    sites: (t.trip_sites ?? [])
      .sort((a, b) => a.position - b.position)
      .map((s) => s.sites)
      .filter((s): s is { id: string; name: string; region: string | null } => Boolean(s)),
    guides: guides.map((g) => ({
      id: g.user_id,
      name: names.get(g.user_id) ?? null,
      role: g.role_label,
    })),
    seatsLeft: Math.max(0, t.max_pilots - Number(c?.seats_taken ?? 0)),
    waitlisted: Number(c?.waitlisted ?? 0),
    interestedCount: Number(c?.interested ?? 0),
    mine: m
      ? {
          status: m.status,
          note: m.note ?? '',
          phone: m.phone ?? '',
          emergencyName: m.emergency_name ?? '',
          emergencyPhone: m.emergency_phone ?? '',
          payment: m.payment_status,
        }
      : null,
    interested: Boolean(interest.data),
  };
}

export function registrationOpen(t: TripDetail, now = Date.now()): boolean {
  return (
    t.status === 'open' &&
    t.startsOn >= istanbulToday(new Date(now)) &&
    (!t.opensAt || new Date(t.opensAt).getTime() <= now) &&
    (!t.deadline || new Date(t.deadline).getTime() >= now)
  );
}

/** Database errors that have their own message (trips.errors.*). */
export const TRIP_ERRORS = [
  'registration_closed',
  'adults_only',
  'no_companions',
  'requirements_not_met',
  'already_registered',
  'declined',
  'not_registered',
  'trip_full',
] as const;
export type TripError = (typeof TRIP_ERRORS)[number] | 'generic';

function fail(message: string | undefined): never {
  throw new Error(TRIP_ERRORS.find((k) => message?.includes(k)) ?? 'generic');
}

export async function setInterest(tripId: string, on: boolean): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) fail(undefined);
  const { error } = on
    ? await supabase.from('trip_interests').insert({ trip_id: tripId, user_id: me })
    : await supabase.from('trip_interests').delete().eq('trip_id', tripId).eq('user_id', me);
  if (error) fail(error.message);
}

export interface RegistrationInput {
  companions: number;
  note: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
}

/** Same rules as tripRegistrationSchema on the website. */
export function validPhone(v: string): boolean {
  const s = v.trim();
  return s.length <= 30 && /^[+0-9 ()-]*$/.test(s);
}

export async function register(tripId: string, r: RegistrationInput): Promise<RegistrationStatus> {
  const { data, error } = await supabase.rpc('register_for_trip', {
    p_trip: tripId,
    p_companions: Math.max(0, Math.min(5, r.companions)),
    p_note: r.note.trim().slice(0, 500) || null,
    p_phone: r.phone.trim() || null,
    p_emergency_name: r.emergencyName.trim().slice(0, 100) || null,
    p_emergency_phone: r.emergencyPhone.trim() || null,
  });
  if (error) fail(error.message);
  return data as RegistrationStatus;
}

export async function updateRegistration(
  tripId: string,
  r: Omit<RegistrationInput, 'companions'>,
): Promise<void> {
  const { error } = await supabase.rpc('update_trip_registration', {
    p_trip: tripId,
    p_note: r.note.trim().slice(0, 500) || null,
    p_phone: r.phone.trim() || null,
    p_emergency_name: r.emergencyName.trim().slice(0, 100) || null,
    p_emergency_phone: r.emergencyPhone.trim() || null,
  });
  if (error) fail(error.message);
}

export async function cancelRegistration(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_trip_registration', { p_trip: tripId });
  if (error) fail(error.message);
}
