import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';

export interface ChatSummary {
  id: string;
  /** Group chats have a title and no single peer. */
  groupTitle: string | null;
  peerId: string | null;
  peerName: string | null;
  adId: string | null;
  adTitle: string | null;
  lastMessageAt: string;
  unread: boolean;
  muted: boolean;
}

/** The viewer's conversations, newest first. */
export async function listChats(userId: string): Promise<ChatSummary[]> {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from('chat_members')
    .select('chat_id, last_read_at, muted')
    .eq('user_id', userId);
  if (!mine?.length) return [];
  const ids = mine.map((m) => m.chat_id);
  const [{ data: chats }, { data: members }] = await Promise.all([
    supabase.from('chats').select('id, kind, title, ad_id, last_message_at').in('id', ids),
    supabase
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', ids)
      .neq('user_id', userId),
  ]);
  const adIds = (chats ?? []).flatMap((c) => (c.ad_id ? [c.ad_id] : []));
  const [names, { data: ads }] = await Promise.all([
    displayNames(
      supabase,
      (members ?? []).map((m) => m.user_id),
    ),
    adIds.length
      ? supabase.from('ads').select('id, title').in('id', adIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const adTitles = new Map((ads ?? []).map((a) => [a.id, a.title]));
  const peerOf = new Map((members ?? []).map((m) => [m.chat_id, m.user_id]));
  const memberOf = new Map(mine.map((m) => [m.chat_id, m]));

  return (chats ?? [])
    .map((c) => {
      const me = memberOf.get(c.id)!;
      const group = c.kind === 'group';
      const peerId = group ? null : (peerOf.get(c.id) ?? null);
      return {
        id: c.id,
        groupTitle: group ? (c.title ?? '') : null,
        peerId,
        peerName: peerId ? (names.get(peerId) ?? null) : null,
        adId: c.ad_id,
        adTitle: c.ad_id ? (adTitles.get(c.ad_id) ?? null) : null,
        lastMessageAt: c.last_message_at,
        unread:
          !me.last_read_at ||
          new Date(me.last_read_at).getTime() < new Date(c.last_message_at).getTime(),
        muted: me.muted,
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}
