import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { t } from '../i18n';
import { hasUnread, listClubMessages, markClubMessageRead, type ClubMessage } from '../chats';
import { istanbulDateTime, previewText } from '../club-format';
import { Body, Title } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Meta, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

// How often the tab checks for new messages while the app is open.
const POLL_MS = 60_000;

/**
 * "Kulüp Mesajları": read-only messages the club sends to everyone, a role or a group the person
 * belongs to (Irmak, 2026-10-30: the app has no chat). Messages are written on the website's admin.
 */
export function MessagesScreen({
  userId,
  onUnread,
  active = true,
}: {
  userId: string | null;
  onUnread?: (unread: boolean) => void;
  /** The tab is showing: refresh the list. */
  active?: boolean;
}) {
  const [messages, setMessages] = useState<ClubMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<ClubMessage | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const list = await listClubMessages(userId);
      setMessages(list);
      setFailed(false);
      onUnread?.(list.some((m) => m.unread));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [userId, onUnread]);

  useEffect(() => {
    if (active) void load();
  }, [load, active]);

  // Keep the tab icon up to date while another tab is open.
  useEffect(() => {
    if (!userId) {
      onUnread?.(false);
      return;
    }
    const check = () => void hasUnread(userId).then(onUnread, () => undefined);
    check();
    const timer = setInterval(check, POLL_MS);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      app.remove();
    };
  }, [userId, onUnread]);

  if (!userId)
    return (
      <View style={screenStyles.page}>
        <Title>{t('clubMessages.title')}</Title>
        <Body muted>{t('home.signIn')}</Body>
      </View>
    );

  if (open)
    return (
      <MessageView
        message={open}
        userId={userId}
        onBack={() => {
          setOpen(null);
          void load();
        }}
      />
    );

  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={messages ?? []}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <Title>{t('clubMessages.title')}</Title>
          <Body muted>{t('clubMessages.lead')}</Body>
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !messages ? <ActivityIndicator /> : null}
          {messages?.length === 0 ? <Body muted>{t('clubMessages.empty')}</Body> : null}
        </View>
      }
      renderItem={({ item }) => (
        <MessageRow
          message={item}
          onPress={() => {
            setOpen(item);
            if (item.unread) {
              const rest = (messages ?? []).map((m) =>
                m.id === item.id ? { ...m, unread: false } : m,
              );
              setMessages(rest);
              onUnread?.(rest.some((m) => m.unread));
            }
          }}
        />
      )}
    />
  );
}

function MessageRow({ message: m, onPress }: { message: ClubMessage; onPress: () => void }) {
  const c = useTheme();
  const when = istanbulDateTime(m.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${m.unread ? `${t('clubMessages.unread')}, ` : ''}${m.title}, ${when}`}
      onPress={onPress}
      style={({ pressed }) => [s.row, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {m.unread ? <View style={[s.dot, { backgroundColor: c.primary }]} /> : null}
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text
            numberOfLines={1}
            style={[s.rowTitle, { color: c.text, fontWeight: m.unread ? '800' : '400' }]}
          >
            {m.title}
          </Text>
          <Text style={[s.when, { color: m.unread ? c.text : c.muted }]}>{when}</Text>
        </View>
        <Text numberOfLines={1} style={[s.preview, { color: m.unread ? c.text : c.muted }]}>
          {previewText(m.body)}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageView({
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
      <BackBar label={t('clubMessages.title')} onBack={onBack} />
      <Meta>
        📣 {t('clubMessages.from')} · {istanbulDateTime(message.createdAt)}
      </Meta>
      <Title>{message.title}</Title>
      <Markdown>{message.body ?? ''}</Markdown>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowTitle: { flex: 1, fontSize: 17 },
  when: { fontSize: 13, fontVariant: ['tabular-nums'] },
  preview: { fontSize: 15 },
});
