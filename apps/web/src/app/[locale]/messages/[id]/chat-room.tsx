'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import type { Tables } from '@/lib/supabase/database.types';
import { Alert, Button } from '@/components/ui';
import { deleteMessage, sendMessage } from '../actions';

type Message = Tables<'messages'>;

const time = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export function ChatRoom(props: {
  chatId: string;
  userId: string;
  peerId: string | null;
  initialMessages: Message[];
  initialImageUrls: Record<string, string>;
  peerLastReadAt: string | null;
  blocked: boolean;
  group?: boolean;
  senderNames?: Record<string, string>;
}) {
  const { chatId, userId, peerId } = props;
  const t = useTranslations('chat');
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [imageUrls, setImageUrls] = useState(props.initialImageUrls);
  const [peerLastReadAt, setPeerLastReadAt] = useState(props.peerLastReadAt);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upsert = useCallback(
    async (message: Message) => {
      setMessages((current) => {
        const i = current.findIndex((m) => m.id === message.id);
        if (i === -1) return [...current, message];
        const next = [...current];
        next[i] = message;
        return next;
      });
      if (message.image_path && !message.deleted_at) {
        const path = message.image_path;
        const { data } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
        if (data?.signedUrl) setImageUrls((u) => ({ ...u, [path]: data.signedUrl }));
      }
    },
    [supabase],
  );

  // Live updates: new/deleted messages and the other person's read receipts.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (payload.new && 'id' in payload.new) void upsert(payload.new as Message);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_members',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const row = payload.new as Tables<'chat_members'>;
          if (row.user_id === peerId) setPeerLastReadAt(row.last_read_at);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, chatId, peerId, upsert]);

  // Mark as read whenever a newer message from the other person is on screen.
  const lastIncoming = [...messages].reverse().find((m) => m.sender_id !== userId);
  const lastMarked = useRef(0);
  useEffect(() => {
    const at = ms(lastIncoming?.created_at ?? null);
    if (!at || at <= lastMarked.current || document.visibilityState !== 'visible') return;
    lastMarked.current = at;
    void supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', userId);
  }, [supabase, chatId, userId, lastIncoming?.created_at]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function send(input: { body?: string; imagePath?: string; lat?: number; lng?: number }) {
    setError(false);
    start(async () => {
      const result = await sendMessage({ chatId, ...input });
      if (result.ok) {
        await upsert(result.message);
        if (input.body) setText('');
      } else {
        setError(true);
      }
    });
  }

  async function sendImage(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await resizeImage(file, 1600, 0.8);
      const path = `${chatId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { contentType: 'image/webp' });
      if (uploadError) throw uploadError;
      send({ imagePath: path });
    } catch {
      setError(true);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function shareLocation() {
    if (!('geolocation' in navigator)) return setError(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        send({
          // ~10 m precision is plenty for "I'm at the landing field".
          lat: Math.round(pos.coords.latitude * 1e4) / 1e4,
          lng: Math.round(pos.coords.longitude * 1e4) / 1e4,
        }),
      () => setError(true),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const lastOwn = [...messages].reverse().find((m) => m.sender_id === userId);
  const seen = !props.group && lastOwn && ms(peerLastReadAt) >= ms(lastOwn.created_at);

  return (
    <div className="flex flex-col gap-3">
      <ol
        className="flex max-h-[60vh] min-h-64 flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-card p-3"
        aria-live="polite"
      >
        {messages.map((m) => {
          const own = m.sender_id === userId;
          return (
            <li key={m.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
              {props.group && !own ? (
                <p className="px-1 text-xs font-semibold text-muted">
                  {(m.sender_id && props.senderNames?.[m.sender_id]) || t('deletedUser')}
                </p>
              ) : null}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  own ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                {m.deleted_at ? (
                  <p className="italic opacity-70">{t('deleted')}</p>
                ) : (
                  <>
                    {m.image_path && imageUrls[m.image_path] ? (
                      <a href={imageUrls[m.image_path]} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img
                          src={imageUrls[m.image_path]}
                          alt=""
                          className="max-h-72 rounded-lg"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    {m.lat !== null && m.lng !== null ? (
                      <a
                        className="underline"
                        href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=15/${m.lat}/${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📍 {t('locationLabel')} · {t('openMap')}
                      </a>
                    ) : null}
                    {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                  </>
                )}
              </div>
              <p className="mt-0.5 flex gap-2 px-1 text-xs text-muted">
                <span>{time(m.created_at, locale)}</span>
                {own && !m.deleted_at ? (
                  <button
                    type="button"
                    className="hover:text-danger hover:underline"
                    onClick={() =>
                      start(async () => {
                        if (await deleteMessage(m.id)) {
                          await upsert({ ...m, deleted_at: new Date().toISOString() });
                        }
                      })
                    }
                  >
                    {t('deleteMessage')}
                  </button>
                ) : null}
                {own && m.id === lastOwn?.id && seen ? <span>✓ {t('seen')}</span> : null}
              </p>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>

      {error ? <Alert tone="error">{t('error')}</Alert> : null}
      {props.blocked || (!peerId && !props.group) ? (
        <Alert>{t('blockedNotice')}</Alert>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send({ body: text.trim() });
          }}
        >
          <label htmlFor="message" className="sr-only">
            {t('placeholder')}
          </label>
          <textarea
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) send({ body: text.trim() });
              }
            }}
            maxLength={4000}
            rows={2}
            placeholder={t('placeholder')}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !text.trim()}>
              {t('send')}
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 font-semibold hover:bg-background">
              📷 <span className="ml-1 hidden sm:inline">{t('image')}</span>
              <span className="sr-only sm:hidden">{t('image')}</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void sendImage(e.target.files?.[0])}
              />
            </label>
            <Button type="button" variant="secondary" onClick={shareLocation} disabled={pending}>
              📍 <span className="hidden sm:inline">{t('location')}</span>
              <span className="sr-only sm:hidden">{t('location')}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
