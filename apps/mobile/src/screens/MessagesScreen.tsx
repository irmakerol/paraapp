import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { t } from '../i18n';
import { dateTimeLabel } from '../content';
import {
  deleteMessage,
  listChats,
  listClubMessages,
  loadRoom,
  markClubMessageRead,
  markRead,
  sendMessage,
  setMuted,
  signImages,
  uploadChatPhoto,
  subscribeRoom,
  unsubscribe,
  type ChatRoom,
  type ChatSummary,
  type ClubMessage,
  type Message,
  createGroup,
  leaveGroup,
  listFollowing,
} from '../chats';
import { Body, Button, Field, Title, Toggle } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Meta, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';
import { pickImage } from '../images';
import { PilotScreen } from './PilotScreen';

type Open =
  | { kind: 'chat'; id: string }
  | { kind: 'club'; message: ClubMessage }
  | { kind: 'pilot'; id: string; from: string }
  | { kind: 'newGroup' }
  | null;

/** "Mesajlar": conversations and messages from the club, as on the website. */
export function MessagesScreen({
  userId,
  openChat,
  onOpened,
  onUnread,
  active = true,
}: {
  userId: string | null;
  /** A chat to open (e.g. started from a pilot's profile). */
  openChat?: string | null;
  onOpened?: () => void;
  onUnread?: (unread: boolean) => void;
  /** The tab is showing: refresh the list. */
  active?: boolean;
}) {
  const c = useTheme();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [club, setClub] = useState<ClubMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Open>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const [ch, cl] = await Promise.all([listChats(userId), listClubMessages(userId)]);
      setChats(ch);
      setClub(cl);
      setFailed(false);
      onUnread?.(ch.some((x) => x.unread && !x.muted) || cl.some((m) => m.unread));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [userId, onUnread]);

  useEffect(() => {
    if (active) void load();
  }, [load, active]);

  useEffect(() => {
    if (openChat) {
      setOpen({ kind: 'chat', id: openChat });
      onOpened?.();
    }
  }, [openChat, onOpened]);

  if (!userId)
    return (
      <View style={screenStyles.page}>
        <Title>{t('chat.title')}</Title>
        <Body muted>{t('home.signIn')}</Body>
      </View>
    );

  const back = () => {
    setOpen(null);
    void load();
  };
  if (open?.kind === 'newGroup')
    return (
      <NewGroup userId={userId} onBack={back} onCreated={(id) => setOpen({ kind: 'chat', id })} />
    );
  if (open?.kind === 'pilot')
    return (
      <PilotScreen
        id={open.id}
        viewerId={userId}
        onBack={() => setOpen({ kind: 'chat', id: open.from })}
        onChat={(id) => setOpen({ kind: 'chat', id })}
      />
    );
  if (open?.kind === 'chat') {
    const from = open.id;
    return (
      <Room
        chatId={open.id}
        userId={userId}
        onBack={back}
        onPilot={(id) => setOpen({ kind: 'pilot', id, from })}
      />
    );
  }
  if (open?.kind === 'club')
    return <ClubView message={open.message} userId={userId} onBack={back} />;

  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={chats ?? []}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <Title>{t('chat.title')}</Title>
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !chats ? <ActivityIndicator /> : null}
          {club.length ? (
            <>
              <Text style={[s.section, { color: c.muted }]}>{t('clubMessages.title')}</Text>
              {club.map((m) => (
                <ListRow
                  key={m.id}
                  icon="📣"
                  title={m.title}
                  when={m.createdAt}
                  unread={m.unread}
                  onPress={() => setOpen({ kind: 'club', message: m })}
                />
              ))}
              <Text style={[s.section, { color: c.muted }]}>{t('chat.title')}</Text>
            </>
          ) : null}
          {chats?.length === 0 ? <Body muted>{t('chat.empty')}</Body> : null}
        </View>
      }
      ListFooterComponent={
        <Button
          label={`👥 ${t('groups.new')}`}
          kind="secondary"
          onPress={() => setOpen({ kind: 'newGroup' })}
        />
      }
      renderItem={({ item }) => (
        <ListRow
          icon={item.groupTitle !== null ? '👥' : (item.peerName ?? '?').slice(0, 1).toUpperCase()}
          title={item.groupTitle ?? item.peerName ?? t('chat.deletedUser')}
          subtitle={
            item.adTitle
              ? t('chat.about', { title: item.adTitle })
              : item.muted
                ? t('chat.muted')
                : null
          }
          when={item.lastMessageAt}
          unread={item.unread && !item.muted}
          onPress={() => setOpen({ kind: 'chat', id: item.id })}
        />
      )}
    />
  );
}

function ListRow({
  icon,
  title,
  subtitle,
  when,
  unread,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle?: string | null;
  when: string;
  unread: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${t('clubMessages.unread')}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [s.row, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[s.avatar, { backgroundColor: c.card }]}>
        <Text style={[s.avatarText, { color: c.text }]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={[s.rowTitle, { color: c.text, fontWeight: unread ? '800' : '600' }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[s.rowSub, { color: c.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[s.when, { color: c.muted }]}>{dateTimeLabel(when)}</Text>
      {unread ? <View style={[s.dot, { backgroundColor: c.danger }]} /> : null}
    </Pressable>
  );
}

function ClubView({
  message,
  userId,
  onBack,
}: {
  message: ClubMessage;
  userId: string;
  onBack: () => void;
}) {
  useEffect(() => {
    if (message.unread) void markClubMessageRead(userId, message.id);
  }, [message, userId]);
  return (
    <ScrollView contentContainerStyle={screenStyles.page}>
      <BackBar label={t('chat.title')} onBack={onBack} />
      <Meta>
        📣 {t('clubMessages.from')} · {dateTimeLabel(message.createdAt)}
      </Meta>
      <Title>{message.title}</Title>
      <Markdown>{message.body}</Markdown>
    </ScrollView>
  );
}

function Room({
  chatId,
  userId,
  onBack,
  onPilot,
}: {
  chatId: string;
  userId: string;
  onBack: () => void;
  onPilot?: (id: string) => void;
}) {
  const c = useTheme();
  const [room, setRoom] = useState<ChatRoom | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [peerRead, setPeerRead] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const upsert = useCallback(async (m: Message) => {
    setMessages((cur) => {
      const i = cur.findIndex((x) => x.id === m.id);
      if (i === -1) return [...cur, m];
      const next = [...cur];
      next[i] = m;
      return next;
    });
    if (m.image_path && !m.deleted_at) {
      const signed = await signImages([m]);
      setImages((u) => ({ ...u, ...signed }));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadRoom(chatId, userId).then(
      (r) => {
        if (!alive) return;
        setRoom(r);
        if (r) {
          setMessages(r.messages);
          setImages(r.imageUrls);
          setPeerRead(r.peerLastReadAt);
        }
      },
      () => alive && setRoom(null),
    );
    const channel = subscribeRoom(
      chatId,
      (m) => void upsert(m),
      (who, at) => {
        if (who !== userId) setPeerRead(at);
      },
    );
    return () => {
      alive = false;
      unsubscribe(channel);
    };
  }, [chatId, userId, upsert]);

  // Mark as read whenever a newer message from someone else is on screen.
  const lastIncoming = [...messages].reverse().find((m) => m.sender_id !== userId)?.created_at;
  useEffect(() => {
    if (lastIncoming) void markRead(chatId, userId);
  }, [chatId, userId, lastIncoming]);

  if (!room)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('chat.title')} onBack={onBack} />
        {room === undefined ? <ActivityIndicator /> : <Body muted>{t('common.error')}</Body>}
      </View>
    );

  const sendPhoto = async (source: 'library' | 'camera') => {
    try {
      const photo = await pickImage(source);
      if (!photo) return;
      setSending(true);
      const path = await uploadChatPhoto(chatId, photo);
      setSending(false);
      if (!path) {
        setError(true);
        return;
      }
      await send({ imagePath: path });
    } catch (e) {
      setSending(false);
      if (e instanceof Error && e.message === 'permission') Alert.alert(t('chat.permission'));
      else setError(true);
    }
  };

  const choosePhoto = () =>
    Alert.alert(t('chat.image'), undefined, [
      { text: t('chat.image'), onPress: () => void sendPhoto('library') },
      { text: t('chat.takePhoto'), onPress: () => void sendPhoto('camera') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const send = async (input: { body?: string; imagePath?: string; lat?: number; lng?: number }) => {
    setSending(true);
    setError(false);
    const m = await sendMessage({ chatId, ...input });
    setSending(false);
    if (!m) {
      setError(true);
      return;
    }
    await upsert(m);
    if (input.body) setText('');
  };

  const shareLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await send({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError(true);
    }
  };

  const remove = (m: Message) =>
    Alert.alert(t('chat.deleteMessage'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.deleteMessage'),
        style: 'destructive',
        onPress: () =>
          void deleteMessage(m.id, userId).then((ok) => {
            if (ok) void upsert({ ...m, deleted_at: new Date().toISOString() });
          }),
      },
    ]);

  const lastMine = [...messages].reverse().find((m) => m.sender_id === userId && !m.deleted_at);
  const seen = Boolean(
    !room.group && lastMine && peerRead && new Date(peerRead) >= new Date(lastMine.created_at),
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.header, { borderColor: c.border }]}>
        <BackBar label={t('chat.title')} onBack={onBack} />
        <Pressable
          accessibilityRole={room.peerId && onPilot ? 'button' : undefined}
          disabled={!room.peerId || !onPilot}
          onPress={() => room.peerId && onPilot?.(room.peerId)}
          style={{ flex: 1 }}
        >
          <Text numberOfLines={1} style={[s.headerTitle, { color: c.text }]}>
            {room.group ? '👥 ' : ''}
            {room.title ?? t('chat.deletedUser')}
          </Text>
        </Pressable>
        {room.group ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(t('groups.leaveConfirm'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('groups.leave'),
                  style: 'destructive',
                  onPress: () =>
                    void leaveGroup(chatId, userId).then((ok) => (ok ? onBack() : setError(true))),
                },
              ])
            }
            style={s.mute}
          >
            <Text style={{ color: c.danger, fontSize: 15, fontWeight: '600' }}>
              {t('groups.leave')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const next = !room.muted;
            setRoom({ ...room, muted: next });
            void setMuted(chatId, userId, next);
          }}
          style={s.mute}
        >
          <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>
            {room.muted ? t('chat.unmute') : t('chat.mute')}
          </Text>
        </Pressable>
      </View>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === userId;
          const sender = m.sender_id ? room.names.get(m.sender_id) : null;
          return (
            <Pressable
              onLongPress={mine && !m.deleted_at ? () => remove(m) : undefined}
              style={[
                s.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: c.primary }
                  : {
                      alignSelf: 'flex-start',
                      backgroundColor: c.card,
                      borderColor: c.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
              ]}
            >
              {room.group && !mine ? (
                <Text style={[s.sender, { color: c.muted }]}>
                  {sender ?? t('chat.deletedUser')}
                </Text>
              ) : null}
              {m.deleted_at ? (
                <Text
                  style={[s.text, { color: mine ? c.primaryText : c.muted, fontStyle: 'italic' }]}
                >
                  {t('chat.deleted')}
                </Text>
              ) : (
                <>
                  {m.image_path && images[m.image_path] ? (
                    <Image
                      source={{ uri: images[m.image_path] }}
                      style={s.image}
                      resizeMode="cover"
                    />
                  ) : null}
                  {m.lat != null && m.lng != null ? (
                    <Text
                      accessibilityRole="link"
                      onPress={() =>
                        void Linking.openURL(
                          `maps://?ll=${m.lat},${m.lng}&q=${encodeURIComponent(t('chat.locationLabel'))}`,
                        )
                      }
                      style={[
                        s.text,
                        {
                          color: mine ? c.primaryText : c.primary,
                          textDecorationLine: 'underline',
                        },
                      ]}
                    >
                      📍 {t('chat.locationLabel')} · {t('chat.openMap')}
                    </Text>
                  ) : null}
                  {m.body ? (
                    <Text style={[s.text, { color: mine ? c.primaryText : c.text }]}>{m.body}</Text>
                  ) : null}
                </>
              )}
              <Text style={[s.time, { color: mine ? c.primaryText : c.muted }]}>
                {dateTimeLabel(m.created_at)}
              </Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          seen ? <Text style={[s.seen, { color: c.muted }]}>{t('chat.seen')}</Text> : null
        }
      />
      {room.blocked ? (
        <View style={[s.composer, { borderColor: c.border }]}>
          <Body muted>{t('chat.blockedNotice')}</Body>
        </View>
      ) : (
        <View style={[s.composer, { borderColor: c.border, backgroundColor: c.bg }]}>
          {error ? <Text style={{ color: c.danger }}>{t('chat.error')}</Text> : null}
          <View style={s.composeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.image')}
              onPress={choosePhoto}
              disabled={sending}
              style={[s.iconButton, { borderColor: c.border }]}
            >
              <Text style={{ fontSize: 20 }}>📷</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.location')}
              onPress={() => void shareLocation()}
              disabled={sending}
              style={[s.iconButton, { borderColor: c.border }]}
            >
              <Text style={{ fontSize: 20 }}>📍</Text>
            </Pressable>
            <TextInput
              accessibilityLabel={t('chat.placeholder')}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={c.muted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4000}
              style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              disabled={sending || !text.trim()}
              onPress={() => void send({ body: text.trim() })}
              style={[
                s.sendButton,
                { backgroundColor: c.primary, opacity: sending || !text.trim() ? 0.5 : 1 },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={c.primaryText} />
              ) : (
                <Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 16 }}>
                  {t('chat.send')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  rowTitle: { fontSize: 17 },
  rowSub: { fontSize: 14 },
  when: { fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  mute: { minHeight: 44, justifyContent: 'center' },
  messages: { padding: 12, gap: 6 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  sender: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  text: { fontSize: 16, lineHeight: 22 },
  image: { width: 220, height: 220, borderRadius: 10, marginBottom: 4 },
  time: { fontSize: 11, opacity: 0.8, marginTop: 2, alignSelf: 'flex-end' },
  seen: { fontSize: 12, alignSelf: 'flex-end', marginRight: 4 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 10 },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 11,
    fontSize: 16,
  },
  sendButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});

function NewGroup({
  userId,
  onBack,
  onCreated,
}: {
  userId: string;
  onBack: () => void;
  onCreated: (chatId: string) => void;
}) {
  const c = useTheme();
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listFollowing(userId).then(setPeople, () => setPeople([]));
  }, [userId]);

  const toggle = (id: string, on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const create = async () => {
    if (!title.trim()) return;
    if (!picked.size) {
      setMessage(t('groups.pickMembers'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      onCreated(await createGroup(title, [...picked]));
    } catch (e) {
      const key = e instanceof Error ? e.message : 'generic';
      setMessage(
        key === 'memberNotAllowed'
          ? t('groups.memberNotAllowed')
          : key === 'full'
            ? t('groups.full')
            : t('groups.adultsOnly'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={screenStyles.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('chat.title')} onBack={onBack} />
      <Title>{t('groups.new')}</Title>
      <Body muted>{t('groups.newLead')}</Body>
      <Field label={t('groups.name')} value={title} onChangeText={setTitle} maxLength={80} />
      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 8, color: c.text }}>
        {t('groups.members')}
      </Text>
      <Meta>{t('groups.membersHelp')}</Meta>
      {people === null ? <ActivityIndicator /> : null}
      {people?.length === 0 ? <Body muted>{t('groups.followFirst')}</Body> : null}
      {people?.map((p) => (
        <Toggle
          key={p.id}
          label={p.name}
          value={picked.has(p.id)}
          onChange={(on) => toggle(p.id, on)}
        />
      ))}
      <Button
        label={t('groups.create')}
        busy={busy}
        disabled={!title.trim() || !people?.length}
        onPress={() => void create()}
      />
      {message ? <Body>{message}</Body> : null}
    </ScrollView>
  );
}
