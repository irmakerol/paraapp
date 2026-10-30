import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/push';
import type { Database, Tables } from '@/lib/supabase/database.types';

export const messageSchema = z
  .object({
    chatId: z.string().uuid(),
    body: z.string().trim().max(4000).optional(),
    imagePath: z.string().max(300).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((m) => m.body || m.imagePath || (m.lat !== undefined && m.lng !== undefined));

/**
 * Inserts a chat message as the sender (RLS decides whether it is allowed) and pushes a short
 * preview to the other members. Used by the website's action and the phone app's route.
 */
export async function sendChatMessage(
  supabase: SupabaseClient<Database>,
  sender: { id: string; name: string },
  input: z.output<typeof messageSchema>,
): Promise<Tables<'messages'> | null> {
  const { chatId, body, imagePath, lat, lng } = input;
  if (imagePath && !imagePath.startsWith(`${chatId}/`)) return null;
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: sender.id,
      body: body || null,
      image_path: imagePath ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select('*')
    .single();
  if (error || !message) return null;

  const [{ data: others }, { data: chat }] = await Promise.all([
    supabase
      .from('chat_members')
      .select('user_id, muted')
      .eq('chat_id', chatId)
      .neq('user_id', sender.id),
    supabase.from('chats').select('kind, title').eq('id', chatId).maybeSingle(),
  ]);
  const recipients = (others ?? []).filter((m) => !m.muted).map((m) => m.user_id);
  if (recipients.length) {
    const name = sender.name;
    const group = chat?.kind === 'group' ? (chat.title ?? '') : null;
    // Only a short preview; location and photos are described, never included.
    await sendPush(recipients, 'messages', (t, locale) => ({
      title: group !== null ? t('newGroupMessage', { name, group }) : t('newMessage', { name }),
      body: body ? body.slice(0, 120) : imagePath ? t('photo') : t('location'),
      url: `/${locale}/messages/${chatId}`,
      tag: `chat-${chatId}`,
    }));
  }
  return message;
}
