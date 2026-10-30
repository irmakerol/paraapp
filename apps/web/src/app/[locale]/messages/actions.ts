'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { sendPush } from '@/lib/push';
import type { Tables } from '@/lib/supabase/database.types';

const messageSchema = z
  .object({
    chatId: z.string().uuid(),
    body: z.string().trim().max(4000).optional(),
    imagePath: z.string().max(300).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((m) => m.body || m.imagePath || (m.lat !== undefined && m.lng !== undefined));

export type SendResult = { ok: true; message: Tables<'messages'> } | { ok: false };

/**
 * Messages go through the server (not straight from the browser) so we can send a push
 * notification to the other person. RLS still decides whether the insert is allowed.
 */
export async function sendMessage(input: z.input<typeof messageSchema>): Promise<SendResult> {
  const viewer = await getViewer();
  const parsed = messageSchema.safeParse(input);
  if (!viewer || !parsed.success) return { ok: false };
  const { chatId, body, imagePath, lat, lng } = parsed.data;
  if (imagePath && !imagePath.startsWith(`${chatId}/`)) return { ok: false };

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: viewer.user.id,
      body: body || null,
      image_path: imagePath ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select('*')
    .single();
  if (error || !message) return { ok: false };

  const [{ data: others }, { data: chat }] = await Promise.all([
    supabase
      .from('chat_members')
      .select('user_id, muted')
      .eq('chat_id', chatId)
      .neq('user_id', viewer.user.id),
    supabase.from('chats').select('kind, title').eq('id', chatId).maybeSingle(),
  ]);
  const recipients = (others ?? []).filter((m) => !m.muted).map((m) => m.user_id);
  if (recipients.length) {
    const name = viewer.profile.display_name;
    const group = chat?.kind === 'group' ? (chat.title ?? '') : null;
    // Only a short preview; location and photos are described, never included.
    await sendPush(recipients, 'messages', (t, locale) => ({
      title: group !== null ? t('newGroupMessage', { name, group }) : t('newMessage', { name }),
      body: body ? body.slice(0, 120) : imagePath ? t('photo') : t('location'),
      url: `/${locale}/messages/${chatId}`,
      tag: `chat-${chatId}`,
    }));
  }
  return { ok: true, message };
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
