'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RSVP_STATUSES } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();

export async function rsvp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const eventId = str(formData, 'event_id');
  const choice = str(formData, 'status');
  if (!uuid.safeParse(eventId).success) return { error: 'generic' };
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (choice === 'withdraw') {
    ({ error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id));
  } else {
    const status = z.enum(RSVP_STATUSES).safeParse(choice);
    if (!status.success) return { error: 'generic' };
    const note = str(formData, 'note').trim().slice(0, 300) || null;
    ({ error } = await supabase
      .from('event_rsvps')
      .upsert({ event_id: eventId, user_id: user.id, status: status.data, note }));
  }
  if (error) {
    if (error.message.includes('event_full')) return { error: 'events.full' };
    if (error.message.includes('rsvp_closed')) return { error: 'events.closed' };
    return { error: 'generic' };
  }
  revalidatePath('/[locale]/events', 'layout');
  return { ok: true };
}
