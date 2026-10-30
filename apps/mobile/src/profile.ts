import { CONFIG } from './config';
import { supabase } from './supabase';

// Must match packages/core (PILOT_LEVEL_CHOICES, LICENCE_BODIES) and the database enums.
export const PILOT_LEVELS = ['p2', 'p3', 'p4', 'p5', 't1', 't2', 't3'] as const;

/** Forms' order P2 < … < P5 < T1 < T2 < T3. Must match trainingLevelOptions() in packages/core. */
const LEVEL_ORDER: Record<string, number> = {
  student: 0,
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
  t1: 6,
  tandem: 6,
  t2: 7,
  t3: 8,
  instructor: 9,
};

/** Levels a student pilot can train for: only those above the current level. */
export function trainingLevelOptions(current: string | null): string[] {
  const floor = current ? (LEVEL_ORDER[current] ?? -1) : -1;
  return PILOT_LEVELS.filter((l) => (LEVEL_ORDER[l] ?? 0) > floor);
}
export const LICENCE_BODIES = ['thk', 'appi', 'ushpa', 'bhpa', 'ffvl', 'dhv', 'other'] as const;
/** Most notable first, as on the website's profile badges. */
export const ROLE_ORDER = [
  'super_admin',
  'admin',
  'instructor',
  'safety_officer',
  'moderator',
  'trip_organiser',
  'guide',
  'pilot',
  'student_pilot',
  'member',
] as const;
export type Role = (typeof ROLE_ORDER)[number];

export interface MyProfile {
  displayName: string;
  fullName: string;
  city: string;
  homeSite: string;
  pilotLevel: string | null;
  trainingLevel: string | null;
  isInstructor: boolean;
  flyingSince: number | null;
  bio: string;
  totalHours: number;
  totalFlights: number;
  createdAt: string;
  locale: string;
  licenceBody: string | null;
  avatarUrl: string | null;
  roles: Role[];
}

interface ProfileRow {
  display_name: string;
  full_name: string | null;
  city: string | null;
  home_site: string | null;
  pilot_level: string | null;
  training_level: string | null;
  is_instructor: boolean;
  flying_since: number | null;
  bio: string | null;
  total_flight_hours: number;
  total_flights: number;
  created_at: string;
  locale: string;
  avatar_path: string | null;
}

export async function loadMyProfile(userId: string): Promise<MyProfile> {
  const [profile, roles, priv] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'display_name, full_name, city, home_site, pilot_level, training_level, is_instructor, flying_since, bio, total_flight_hours, total_flights, created_at, locale, avatar_path',
      )
      .eq('id', userId)
      .single(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('profile_private').select('licence_body').eq('user_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  const p = profile.data as ProfileRow;
  let avatarUrl: string | null = null;
  if (p.avatar_path) {
    const { data } = await supabase.storage.from('avatars').createSignedUrl(p.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }
  const held = new Set(((roles.data ?? []) as { role: string }[]).map((r) => r.role));
  return {
    displayName: p.display_name,
    fullName: p.full_name ?? '',
    city: p.city ?? '',
    homeSite: p.home_site ?? '',
    pilotLevel: p.pilot_level,
    trainingLevel: p.training_level,
    isInstructor: p.is_instructor,
    flyingSince: p.flying_since,
    bio: p.bio ?? '',
    totalHours: Number(p.total_flight_hours),
    totalFlights: p.total_flights,
    createdAt: p.created_at,
    locale: p.locale,
    licenceBody: (priv.data as { licence_body: string | null } | null)?.licence_body ?? null,
    avatarUrl,
    roles: ROLE_ORDER.filter((r) => held.has(r)),
  };
}

export interface ProfileEdit {
  displayName: string;
  fullName: string;
  city: string;
  homeSite: string;
  pilotLevel: string | null;
  /** Only saved for student pilots (null otherwise means "leave as is"). */
  trainingLevel?: string | null;
  isInstructor: boolean;
  flyingSince: number | null;
  bio: string;
  licenceBody: string | null;
}

/** Same columns the website's profile form writes (column grants and checks apply). */
export async function saveMyProfile(userId: string, edit: ProfileEdit): Promise<void> {
  const blank = (v: string) => (v.trim() === '' ? null : v.trim());
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: edit.displayName.trim(),
      full_name: blank(edit.fullName),
      city: blank(edit.city),
      home_site: blank(edit.homeSite),
      pilot_level: edit.pilotLevel,
      is_instructor: edit.isInstructor,
      ...(edit.trainingLevel !== undefined ? { training_level: edit.trainingLevel } : {}),
      flying_since: edit.flyingSince,
      bio: blank(edit.bio),
    })
    .eq('id', userId);
  if (error) throw error;
  const { error: privError } = await supabase
    .from('profile_private')
    .update({ licence_body: edit.licenceBody })
    .eq('user_id', userId);
  if (privError) throw privError;
}

export async function saveLocale(userId: string, locale: string): Promise<void> {
  await supabase.from('profiles').update({ locale }).eq('id', userId);
}

/** Deletes the account on the server (files, then the anonymise-then-purge request). */
export async function deleteMyAccount(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const res = await fetch(`${CONFIG.webUrl}/api/mobile/account/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
