import { supabase } from './supabase';
import { sample } from './content';

export interface PilotCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  homeSite: string | null;
  pilotLevel: string | null;
  isInstructor: boolean;
  flyingSince: number | null;
  yearsFlying: number | null;
  wings: string | null;
  bio: string | null;
  totalHours: number | null;
  totalFlights: number | null;
  roles: string[];
  followers: number;
  isFollowing: boolean;
  blocked: boolean;
}

/** Another pilot, only through the privacy-masked profile_cards view (as on the website). */
export async function loadPilot(id: string, viewerId: string | null): Promise<PilotCard | null> {
  const { data } = await supabase.from('profile_cards').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const c = data as {
    id: string;
    display_name: string;
    avatar_path: string | null;
    city: string | null;
    country: string | null;
    home_site: string | null;
    pilot_level: string | null;
    is_instructor: boolean | null;
    flying_since: number | null;
    years_flying: number | null;
    wings: string | null;
    bio: string | null;
    total_flight_hours: number | null;
    total_flights: number | null;
    roles: string[] | null;
  };
  const [{ data: counts }, follow, block, avatar] = await Promise.all([
    supabase.rpc('follow_counts', { p_user: id }),
    viewerId && viewerId !== id
      ? supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', viewerId)
          .eq('followee_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    viewerId && viewerId !== id
      ? supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', viewerId)
          .eq('blocked_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    c.avatar_path
      ? supabase.storage.from('avatars').createSignedUrl(c.avatar_path, 3600)
      : Promise.resolve({ data: null }),
  ]);
  return {
    id: c.id,
    name: sample(c.display_name),
    avatarUrl: (avatar.data as { signedUrl: string } | null)?.signedUrl ?? null,
    city: c.city,
    country: c.country,
    homeSite: c.home_site,
    pilotLevel: c.pilot_level,
    isInstructor: Boolean(c.is_instructor),
    flyingSince: c.flying_since,
    yearsFlying: c.years_flying,
    wings: c.wings,
    bio: c.bio,
    totalHours: c.total_flight_hours,
    totalFlights: c.total_flights,
    roles: c.roles ?? [],
    followers: Number(((counts ?? []) as { followers: number }[])[0]?.followers ?? 0),
    isFollowing: Boolean(follow.data),
    blocked: Boolean(block.data),
  };
}

export async function setFollowing(
  viewerId: string,
  id: string,
  follow: boolean,
): Promise<boolean> {
  const { error } = follow
    ? await supabase.from('follows').insert({ follower_id: viewerId, followee_id: id })
    : await supabase.from('follows').delete().eq('follower_id', viewerId).eq('followee_id', id);
  return !error || error.code === '23505';
}
