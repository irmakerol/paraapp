import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** The phone refreshes its row every few minutes while recording; older rows are stale. */
export const ACTIVE_FLIGHT_FRESH_MS = 20 * 60 * 1000;

/** When the signed-in pilot's phone is recording a flight right now, its start time. */
export async function activeFlightStart(userId: string): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('active_flights')
    .select('started_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  const fresh = Date.now() - new Date(data.updated_at).getTime() < ACTIVE_FLIGHT_FRESH_MS;
  return fresh ? new Date(data.started_at) : null;
}
