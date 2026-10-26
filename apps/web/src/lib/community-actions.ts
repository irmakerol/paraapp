'use server';
import { revalidatePath } from 'next/cache';
import { reportSchema } from '@paraapp/core';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

/** Anyone signed in can report content or a user. Moderators see it in the admin queue. */
export async function fileReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: 'common.signInToContinue' };
  const parsed = reportSchema.safeParse({
    target_type: str(formData, 'target_type'),
    target_id: str(formData, 'target_id'),
    reason: str(formData, 'reason'),
    details: str(formData, 'details'),
  });
  if (!parsed.success) return { error: 'validation' };
  const supabase = await createClient();
  const { error } = await supabase.from('reports').insert({
    ...parsed.data,
    details: parsed.data.details ?? null,
    reporter_id: user.id,
  });
  if (error) return { error: 'generic' };
  return { ok: true };
}

const uuid = z.string().uuid();

export async function setBlocked(userId: string, blocked: boolean): Promise<ActionState> {
  const user = await getUser();
  if (!user || !uuid.safeParse(userId).success || userId === user.id) return { error: 'generic' };
  const supabase = await createClient();
  const { error } = blocked
    ? await supabase
        .from('blocks')
        .upsert({ blocker_id: user.id, blocked_id: userId }, { ignoreDuplicates: true })
    : await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
  if (error) return { error: 'generic' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
