import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import type { PreparedImage } from './images';
import { CONFIG } from './config';
import { supabase } from './supabase';
import { displayNames, sample } from './content';

// Conversations, read with the user's session (RLS: members only). Sending goes through the
// website (/api/mobile/messages) so the other members get a push, like on the website.

export interface ChatSummary {
  id: string;
  groupTitle: string | null;
  peerId: string | null;
  peerName: string | null;
  adTitle: string | null;
  lastMessageAt: string;
  unread: boolean;
  muted: boolean;
}

export interface ClubMessage {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  unread: boolean;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string | null;
  body: string | null;
  image_path: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  deleted_at: string | null;
}

export async function listChats(userId: string): Promise<ChatSummary[]> {
  const { data: mine, error } = await supabase
    .from('chat_members')
    .select('chat_id, last_read_at, muted')
    .eq('user_id', userId);
  if (error) throw error;
  const rows = (mine ?? []) as { chat_id: string; last_read_at: string | null; muted: boolean }[];
  if (!rows.length) return [];
  const ids = rows.map((m) => m.chat_id);
  const [{ data: chats }, { data: members }] = await Promise.all([
    supabase.from('chats').select('id, kind, title, ad_id, last_message_at').in('id', ids),
    supabase
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', ids)
      .neq('user_id', userId),
  ]);
  const chatRows = (chats ?? []) as {
    id: string;
    kind: string;
    title: string | null;
    ad_id: string | null;
    last_message_at: string;
  }[];
  const memberRows = (members ?? []) as { chat_id: string; user_id: string }[];
  const adIds = chatRows.flatMap((c) => (c.ad_id ? [c.ad_id] : []));
  const [names, ads] = await Promise.all([
    displayNames(memberRows.map((m) => m.user_id)),
    adIds.length
      ? supabase.from('ads').select('id, title').in('id', adIds)
      : Promise.resolve({ data: [] }),
  ]);
  const adTitles = new Map(
    ((ads.data ?? []) as { id: string; title: string }[]).map((a) => [a.id, a.title]),
  );
  const peerOf = new Map(memberRows.map((m) => [m.chat_id, m.user_id]));
  const memberOf = new Map(rows.map((m) => [m.chat_id, m]));
  return chatRows
    .flatMap((c) => {
      const me = memberOf.get(c.id);
      if (!me) return [];
      const group = c.kind === 'group';
      const peerId = group ? null : (peerOf.get(c.id) ?? null);
      return [
        {
          id: c.id,
          groupTitle: group ? sample(c.title ?? '') : null,
          peerId,
          peerName: peerId ? (names.get(peerId) ?? null) : null,
          adTitle: c.ad_id ? (adTitles.get(c.ad_id) ?? null) : null,
          lastMessageAt: c.last_message_at,
          unread: !me.last_read_at || new Date(me.last_read_at) < new Date(c.last_message_at),
          muted: me.muted,
        },
      ];
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/** Club messages this person received (RLS: only their own), newest first. */
export async function listClubMessages(userId: string): Promise<ClubMessage[]> {
  const { data, error } = await supabase
    .from('club_messages')
    .select('id, title, body, created_at, club_message_recipients!inner(read_at, user_id)')
    .eq('club_message_recipients.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      title: string;
      body: string | null;
      created_at: string;
      club_message_recipients: { read_at: string | null }[];
    }[]
  ).map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    createdAt: m.created_at,
    unread: m.club_message_recipients.some((r) => r.read_at === null),
  }));
}

export async function markClubMessageRead(userId: string, id: string): Promise<void> {
  await supabase
    .from('club_message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('message_id', id)
    .eq('user_id', userId)
    .is('read_at', null);
}

/** True when a club message is unread (the Club Messages tab icon bounces). */
export async function hasUnread(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('club_message_recipients')
    .select('message_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface ChatRoom {
  id: string;
  group: boolean;
  title: string | null;
  peerId: string | null;
  peerLastReadAt: string | null;
  muted: boolean;
  blocked: boolean;
  names: Map<string, string>;
  messages: Message[];
  imageUrls: Record<string, string>;
}

export async function loadRoom(chatId: string, userId: string): Promise<ChatRoom | null> {
  const { data: chat } = await supabase
    .from('chats')
    .select('id, kind, title')
    .eq('id', chatId)
    .maybeSingle();
  if (!chat) return null;
  const c = chat as { id: string; kind: string; title: string | null };
  const [{ data: members }, { data: history }] = await Promise.all([
    supabase.from('chat_members').select('user_id, last_read_at, muted').eq('chat_id', chatId),
    supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  const memberRows = (members ?? []) as {
    user_id: string;
    last_read_at: string | null;
    muted: boolean;
  }[];
  const group = c.kind === 'group';
  const peer = group ? undefined : memberRows.find((m) => m.user_id !== userId);
  const me = memberRows.find((m) => m.user_id === userId);
  let blocked = false;
  if (peer) {
    // Only your own blocks are visible (RLS); the database refuses sends across either.
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
      .eq('blocked_id', peer.user_id);
    blocked = Boolean(blocks?.length);
  }
  const messages = ((history ?? []) as Message[]).reverse();
  const names = await displayNames(memberRows.map((m) => m.user_id));
  return {
    id: c.id,
    group,
    title: group ? sample(c.title ?? '') : peer ? (names.get(peer.user_id) ?? null) : null,
    peerId: peer?.user_id ?? null,
    peerLastReadAt: peer?.last_read_at ?? null,
    muted: me?.muted ?? false,
    blocked,
    names,
    messages,
    imageUrls: await signImages(messages),
  };
}

export async function signImages(messages: Message[]): Promise<Record<string, string>> {
  const paths = messages.flatMap((m) => (m.image_path && !m.deleted_at ? [m.image_path] : []));
  if (!paths.length) return {};
  const { data } = await supabase.storage.from('chat-media').createSignedUrls(paths, 3600);
  return Object.fromEntries(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  );
}

/** New and deleted messages and the other person's read receipts, live. */
export function subscribeRoom(
  chatId: string,
  onMessage: (m: Message) => void,
  onRead: (userId: string, at: string | null) => void,
): RealtimeChannel {
  return supabase
    .channel(`chat:${chatId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        if (payload.new && 'id' in payload.new) onMessage(payload.new as Message);
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string | null };
        onRead(row.user_id, row.last_read_at);
      },
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
}

export async function markRead(chatId: string, userId: string): Promise<void> {
  await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
}

export async function setMuted(chatId: string, userId: string, muted: boolean): Promise<void> {
  await supabase.from('chat_members').update({ muted }).eq('chat_id', chatId).eq('user_id', userId);
}

/** Uploads a re-encoded photo into the chat's folder (members only) and returns its path. */
export async function uploadChatPhoto(
  chatId: string,
  photo: PreparedImage,
): Promise<string | null> {
  const path = `${chatId}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, photo.bytes, { contentType: photo.contentType });
  return error ? null : path;
}

export async function sendMessage(input: {
  chatId: string;
  body?: string;
  imagePath?: string;
  lat?: number;
  lng?: number;
}): Promise<Message | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(`${CONFIG.webUrl}/api/mobile/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: Message } | null;
  return body?.message ?? null;
}

export async function deleteMessage(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', userId);
  return !error;
}

/** Opens (or finds) the 1-to-1 chat with another member. Throws 'minor' | 'blocked' | 'unavailable'. */
export async function startDirectChat(other: string, adId?: string): Promise<string> {
  const { data, error } = await supabase.rpc(
    'start_direct_chat',
    adId ? { p_other: other, p_ad: adId } : { p_other: other },
  );
  if (error || !data) {
    if (error?.message.includes('minor')) throw new Error('minor');
    if (error?.message.includes('blocked')) throw new Error('blocked');
    throw new Error('unavailable');
  }
  return data as string;
}

/** People the user follows (group chats can only include them). */
export async function listFollowing(userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  if (error) throw error;
  const ids = ((data ?? []) as { followee_id: string }[]).map((r) => r.followee_id);
  const names = await displayNames(ids);
  return ids
    .flatMap((id) => {
      const name = names.get(id);
      return name ? [{ id, name }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Throws 'memberNotAllowed' | 'full' | 'generic'. The database checks age, blocks and size. */
export async function createGroup(title: string, members: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_chat', {
    p_title: title.trim(),
    p_members: members,
  });
  if (error || !data) {
    if (error?.message.includes('member_not_allowed')) throw new Error('memberNotAllowed');
    if (error?.message.includes('group_full')) throw new Error('full');
    throw new Error('generic');
  }
  return data as string;
}

export async function leaveGroup(chatId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('remove_group_member', { p_chat: chatId, p_user: userId });
  return !error;
}
