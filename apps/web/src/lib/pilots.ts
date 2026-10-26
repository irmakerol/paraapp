import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/** A pilot's card through the masked `profile_cards` view (null when hidden from the viewer). */
export const getPilotCard = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profile_cards').select('*').eq('id', id).maybeSingle();
  return data;
});

export async function avatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function followState(viewerId: string | undefined, pilotId: string) {
  const supabase = await createClient();
  const [{ data: counts }, following] = await Promise.all([
    supabase.rpc('follow_counts', { p_user: pilotId }),
    viewerId && viewerId !== pilotId
      ? supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', viewerId)
          .eq('followee_id', pilotId)
          .maybeSingle()
          .then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ]);
  return {
    followers: counts?.[0]?.followers ?? 0,
    following: counts?.[0]?.following ?? 0,
    isFollowing: following,
  };
}
