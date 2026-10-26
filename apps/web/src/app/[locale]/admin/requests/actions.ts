'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { str } from '@/lib/form';
import type { ActionState } from '@/lib/action-state';

const uuid = z.string().uuid();
const statusSchema = z.enum(['received', 'in_progress', 'completed', 'rejected']);
const typeSchema = z.enum([
  'access',
  'rectification',
  'erasure',
  'restriction',
  'portability',
  'objection',
  'withdraw_consent',
  'other',
]);

export async function updateRequest(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const id = str(formData, 'id');
  const status = statusSchema.safeParse(str(formData, 'status'));
  if (!viewer || !canUse(viewer, 'requests') || !uuid.safeParse(id).success || !status.success)
    return;
  const supabase = await createClient();
  const done = status.data === 'completed' || status.data === 'rejected';
  await supabase
    .from('data_requests')
    .update({
      status: status.data,
      notes: str(formData, 'notes').slice(0, 4000) || null,
      handled_by: viewer.user.id,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id);
  revalidatePath('/[locale]/admin/requests', 'page');
}

/** Requests that arrive by email or post are logged here so the deadline is tracked. */
export async function logRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'requests')) return { error: 'generic' };
  const email = z.string().email().max(200).safeParse(str(formData, 'email').trim());
  const type = typeSchema.safeParse(str(formData, 'request_type'));
  if (!email.success || !type.success) return { error: 'validation' };
  const supabase = await createClient();
  const { error } = await supabase.from('data_requests').insert({
    requester_email: email.data,
    request_type: type.data,
    channel: 'email',
    details: str(formData, 'details').slice(0, 4000) || null,
  });
  if (error) return { error: 'generic' };
  revalidatePath('/[locale]/admin/requests', 'page');
  return { ok: true };
}
