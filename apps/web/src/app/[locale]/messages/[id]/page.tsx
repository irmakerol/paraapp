import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';
import { BlockButton } from '@/components/block-button';
import { ReportButton } from '@/components/report-button';
import { ChatRoom } from './chat-room';
import { MuteButton } from './mute-button';

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
  const me = members?.find((m) => m.user_id === viewer.user.id);
  const peer = members?.find((m) => m.user_id !== viewer.user.id);
  const names = await displayNames(supabase, [peer?.user_id]);
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
  const peerName = peer ? (names.get(peer.user_id) ?? t('deletedUser')) : t('deletedUser');

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
      />
      <ReportButton targetType="chat" targetId={id} className="self-end" />
    </div>
  );
}
