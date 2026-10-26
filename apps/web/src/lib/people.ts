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
