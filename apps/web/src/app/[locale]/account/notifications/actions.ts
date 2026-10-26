'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { bool } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(input: unknown, userAgent: string): Promise<boolean> {
  const user = await getUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!user || !parsed.success) return false;
  const supabase = await createClient();
  // The endpoint is unique: re-subscribing on the same device replaces the old row.
  await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  return !error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);
}

export async function saveNotificationPrefs(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'generic' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      notification_prefs: {
        messages: bool(formData, 'messages'),
        news: bool(formData, 'news'),
        ads: bool(formData, 'ads'),
        equipment: bool(formData, 'equipment'),
      },
    })
    .eq('id', user.id);
  if (error) return { error: 'generic' };
  revalidatePath('/[locale]/account/notifications', 'page');
  return { ok: true };
}
