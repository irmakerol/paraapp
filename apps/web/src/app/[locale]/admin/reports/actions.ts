'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { str } from '@/lib/form';

const uuid = z.string().uuid();

type Action =
  | 'dismiss'
  | 'hide_comment'
  | 'remove_ad'
  | 'unpublish_tip'
  | 'remove_ride'
  | 'ban7'
  | 'ban30'
  | 'ban_forever'
  | 'unban';

const BAN_DAYS: Partial<Record<Action, number | null>> = {
  ban7: 7,
  ban30: 30,
  // "Permanent" is a date far in the future; an admin can lift it.
  ban_forever: 365 * 100,
};

/** Moderators resolve a report with one action. Every action is checked again by RLS. */
export async function moderate(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'reports')) return;
  const reportId = str(formData, 'report_id');
  const action = str(formData, 'action') as Action;
  const targetId = str(formData, 'target_id');
  const offender = str(formData, 'offender_id');
  const note = str(formData, 'note').trim().slice(0, 1000) || null;
  if (!uuid.safeParse(reportId).success) return;
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === 'hide_comment' && uuid.safeParse(targetId).success) {
    await supabase
      .from('news_comments')
      .update({ hidden_at: now, hidden_by: viewer.user.id })
      .eq('id', targetId);
  } else if (action === 'remove_ad' && uuid.safeParse(targetId).success) {
    await supabase
      .from('ads')
      .update({ removed_at: now, removed_by: viewer.user.id })
      .eq('id', targetId);
  } else if (action === 'unpublish_tip' && uuid.safeParse(targetId).success) {
    await supabase
      .from('tips')
      .update({ status: 'rejected', review_note: note, reviewed_by: viewer.user.id })
      .eq('id', targetId);
  } else if (action === 'remove_ride' && uuid.safeParse(targetId).success) {
    await supabase.from('rides').delete().eq('id', targetId);
  } else if (action in BAN_DAYS && uuid.safeParse(offender).success) {
    const until = new Date(Date.now() + BAN_DAYS[action]! * 86400_000).toISOString();
    const { error } = await supabase.rpc('ban_user', {
      p_user: offender,
      p_until: until,
      p_reason: note ?? `report ${reportId}`,
    });
    if (error) return;
  } else if (action === 'unban' && uuid.safeParse(offender).success) {
    await supabase.rpc('ban_user', { p_user: offender, p_until: null, p_reason: note ?? 'unban' });
  } else if (action !== 'dismiss') {
    return;
  }

  await supabase
    .from('reports')
    .update({
      status: action === 'dismiss' ? 'dismissed' : 'actioned',
      resolution_note: note,
      handled_by: viewer.user.id,
      handled_at: now,
    })
    .eq('id', reportId);
  revalidatePath('/[locale]/admin/reports', 'layout');
}
