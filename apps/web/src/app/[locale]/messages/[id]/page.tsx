import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { displayNames, followedPeople } from '@/lib/people';
import { Button } from '@/components/ui';
import { BlockButton } from '@/components/block-button';
import { ReportButton } from '@/components/report-button';
import { ChatRoom } from './chat-room';
import { MuteButton } from './mute-button';
import { AddMemberForm, RenameForm } from '../group-forms';
import { removeGroupMember } from '../group-actions';

export const dynamic = 'force-dynamic';

const HISTORY = 200;

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('chat');
  const g = await getTranslations('groups');
  const supabase = await createClient();

  const { data: chat } = await supabase.from('chats').select('*').eq('id', id).maybeSingle();
  if (!chat) notFound();
  const [{ data: members }, { data: history }, { data: ad }] = await Promise.all([
    supabase.from('chat_members').select('user_id, last_read_at, muted').eq('chat_id', id),
    supabase
      .from('messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: false })
      .limit(HISTORY),
    chat.ad_id
      ? supabase.from('ads').select('id, title').eq('id', chat.ad_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const group = chat.kind === 'group';
  const me = members?.find((m) => m.user_id === viewer.user.id);
  const peer = group ? undefined : members?.find((m) => m.user_id !== viewer.user.id);
  const names = await displayNames(
    supabase,
    group ? (members ?? []).map((m) => m.user_id) : [peer?.user_id],
  );
  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const canAdd = group && viewer.profile.age_group === 'adult';
  const addable = canAdd
    ? (await followedPeople(supabase, viewer.user.id)).filter((p) => !memberIds.has(p.id))
    : [];
  const { data: block } = peer
    ? await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', viewer.user.id)
        .eq('blocked_id', peer.user_id)
        .maybeSingle()
    : { data: null };

  const messages = (history ?? []).reverse();
  const imagePaths = messages.flatMap((m) => (m.image_path && !m.deleted_at ? [m.image_path] : []));
  const { data: signed } = imagePaths.length
    ? await supabase.storage.from('chat-media').createSignedUrls(imagePaths, 60 * 60)
    : { data: [] };
  const imageUrls = Object.fromEntries(
    (signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])),
  );
  const peerName = group
    ? chat.title || g('untitled')
    : peer
      ? (names.get(peer.user_id) ?? t('deletedUser'))
      : t('deletedUser');
  // In groups every message shows who sent it (names come from the masked profile view).
  const senderNames = group ? Object.fromEntries(names) : {};
  const isCreator = chat.created_by === viewer.user.id;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <Link
          href="/messages"
          className="text-sm text-muted hover:underline"
          aria-label={t('title')}
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{peerName}</h1>
          {ad ? (
            <Link
              href={`/market/${ad.id}`}
              className="block truncate text-sm text-muted hover:underline"
            >
              {t('about', { title: ad.title })}
            </Link>
          ) : null}
        </div>
        {group ? (
          <span className="text-sm text-muted">{g('memberCount', { count: memberIds.size })}</span>
        ) : null}
        <MuteButton chatId={id} muted={me?.muted ?? false} />
        {peer ? <BlockButton userId={peer.user_id} blocked={Boolean(block)} /> : null}
      </header>
      <ChatRoom
        chatId={id}
        userId={viewer.user.id}
        peerId={peer?.user_id ?? null}
        initialMessages={messages}
        initialImageUrls={imageUrls}
        peerLastReadAt={peer?.last_read_at ?? null}
        blocked={Boolean(block)}
        group={group}
        senderNames={senderNames}
      />
      {group ? (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">{g('manage')}</summary>
          <div className="mt-4 space-y-5">
            <ul className="divide-y divide-border text-sm">
              {(members ?? []).map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/pilots/${m.user_id}`} className="flex-1 hover:underline">
                    {names.get(m.user_id) ?? t('deletedUser')}
                    {m.user_id === chat.created_by ? (
                      <span className="ml-2 text-xs text-muted">{g('creator')}</span>
                    ) : null}
                  </Link>
                  {isCreator && m.user_id !== viewer.user.id ? (
                    <form action={removeGroupMember}>
                      <input type="hidden" name="chat_id" value={id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input type="hidden" name="locale" value={locale} />
                      <Button variant="ghost">{g('remove')}</Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canAdd ? <AddMemberForm chatId={id} people={addable} /> : null}
            <RenameForm chatId={id} title={chat.title ?? ''} />
            <form action={removeGroupMember}>
              <input type="hidden" name="chat_id" value={id} />
              <input type="hidden" name="user_id" value={viewer.user.id} />
              <input type="hidden" name="locale" value={locale} />
              <Button variant="danger">{g('leave')}</Button>
            </form>
          </div>
        </details>
      ) : null}
      <ReportButton targetType="chat" targetId={id} className="self-end" />
    </div>
  );
}
