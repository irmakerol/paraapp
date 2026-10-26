import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Display names through the masked `profile_cards` view, so privacy settings apply.
 * Missing ids (deleted users, or private profiles for guests) are simply absent.
 */
export async function displayNames(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from('profile_cards').select('id, display_name').in('id', unique);
  return new Map((data ?? []).map((p) => [p.id!, p.display_name!]));
}

/** People the user follows, by name: the pick list for group chats. */
export async function followedPeople(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.from('follows').select('followee_id').eq('follower_id', userId);
  const names = await displayNames(
    supabase,
    (data ?? []).map((f) => f.followee_id),
  );
  return [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
