'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ROLES } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { localeFrom, str } from '@/lib/form';
import { sendPush } from '@/lib/push';
import type { ActionState } from '@/lib/action-state';

const messageSchema = z.discriminatedUnion('audience', [
  z.object({ audience: z.literal('all') }),
  z.object({ audience: z.literal('role'), role: z.enum(ROLES) }),
  z.object({ audience: z.literal('group'), group: z.string().uuid() }),
]);
const textSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(4000),
});

/**
 * The super admin sends a club message to everyone, one role or one group. The database picks the
 * recipients and records the message; a phone notification follows for people who allow
 * message notifications.
 */
export async function sendClubMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !canUse(viewer, 'broadcast')) return { error: 'generic' };
  const audience = messageSchema.safeParse({
    audience: str(formData, 'audience'),
    role: str(formData, 'role') || undefined,
    group: str(formData, 'group') || undefined,
  });
  const text = textSchema.safeParse({ title: str(formData, 'title'), body: str(formData, 'body') });
  if (!audience.success || !text.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of audience.error?.issues ?? []) {
      fieldErrors[String(issue.path[0] ?? 'audience')] = 'validation';
    }
    for (const issue of text.error?.issues ?? []) fieldErrors[String(issue.path[0])] = 'validation';
    return { error: 'validation', fieldErrors };
  }
  const a = audience.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('send_club_message', {
    p_audience: a.audience,
    p_role: a.audience === 'role' ? a.role : null,
    p_group: a.audience === 'group' ? a.group : null,
    p_title: text.data.title,
    p_body: text.data.body,
  });
  if (error || !id)
    return { error: error?.code === '42501' ? 'admin.usersAdmin.notAllowed' : 'generic' };

  const { data: recipients } = await supabase
    .from('club_message_recipients')
    .select('user_id')
    .eq('message_id', id);
  const others = (recipients ?? []).map((r) => r.user_id).filter((u) => u !== viewer.user.id);
  await sendPush(others, 'messages', (_t, locale) => ({
    title: text.data.title,
    body: text.data.body.slice(0, 140),
    url: `/${locale}/messages/club/${id}`,
    tag: `club-${id}`,
  }));
  revalidatePath(`/${localeFrom(formData)}/admin/broadcast`);
  return { ok: true, values: { count: String((recipients ?? []).length) } };
}
