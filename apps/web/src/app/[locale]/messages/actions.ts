'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { messageSchema, sendChatMessage } from '@/lib/send-message';
import type { Tables } from '@/lib/supabase/database.types';

export type SendResult = { ok: true; message: Tables<'messages'> } | { ok: false };

/**
 * Messages go through the server (not straight from the browser) so we can send a push
 * notification to the other person. RLS still decides whether the insert is allowed.
 */
export async function sendMessage(input: z.input<typeof messageSchema>): Promise<SendResult> {
  const viewer = await getViewer();
  const parsed = messageSchema.safeParse(input);
  if (!viewer || !parsed.success) return { ok: false };
  const message = await sendChatMessage(
    await createClient(),
    { id: viewer.user.id, name: viewer.profile.display_name },
    parsed.data,
  );
  return message ? { ok: true, message } : { ok: false };
}

export async function deleteMessage(id: string): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer || !z.string().uuid().safeParse(id).success) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', viewer.user.id);
  return !error;
}

export async function setMuted(chatId: string, muted: boolean): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || !z.string().uuid().safeParse(chatId).success) return;
  const supabase = await createClient();
  await supabase
    .from('chat_members')
    .update({ muted })
    .eq('chat_id', chatId)
    .eq('user_id', viewer.user.id);
  revalidatePath(`/[locale]/messages/${chatId}`, 'page');
}

/** Marks a club message as read for the signed-in person (RLS: own receipt only). */
export async function markClubMessageRead(messageId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || !z.string().uuid().safeParse(messageId).success) return;
  const supabase = await createClient();
  await supabase
    .from('club_message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('message_id', messageId)
    .eq('user_id', viewer.user.id)
    .is('read_at', null);
  revalidatePath('/[locale]/messages', 'page');
}
