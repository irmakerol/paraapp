import { supabase } from '../supabase';

/**
 * Tells the website "this pilot is flying" while the phone records (no position is sent), so
 * its Fly button turns into "Flying". Best effort: without signal or an account it does nothing.
 */
const REFRESH_MS = 5 * 60 * 1000;
let lastSent = 0;

async function userId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function markFlying(startedAt: number) {
  const id = await userId();
  if (!id) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('active_flights')
    .upsert({ user_id: id, started_at: new Date(startedAt).toISOString(), updated_at: now });
  if (!error) lastSent = Date.now();
}

/** Called on every location batch; only talks to the server every few minutes. */
export async function keepFlying(startedAt: number) {
  if (Date.now() - lastSent < REFRESH_MS) return;
  lastSent = Date.now();
  await markFlying(startedAt).catch(() => undefined);
}

export async function markLanded() {
  const id = await userId();
  if (!id) return;
  await supabase.from('active_flights').delete().eq('user_id', id);
  lastSent = 0;
}
