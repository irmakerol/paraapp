import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { t } from '../i18n';
import {
  addComment,
  dateLabel,
  deleteComment,
  listNews,
  loadArticle,
  setLike,
  type Article,
  type NewsItem,
} from '../content';
import { Badge, Body, Button, Title } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Meta, Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

/** "Haberler": the club's news, as on the website. */
export function NewsScreen({
  userId,
  onBack,
  initialId,
}: {
  userId: string | null;
  onBack: () => void;
  initialId?: string | null;
}) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(initialId ?? null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await listNews());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, userId]);

  if (open) return <ArticleView id={open} userId={userId} onBack={() => setOpen(null)} />;

  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={items ?? []}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <BackBar onBack={onBack} />
          <Title>{t('nav.news')}</Title>
          <Body muted>{t('news.lead')}</Body>
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !items ? <ActivityIndicator /> : null}
          {items?.length === 0 ? <Body muted>{t('news.empty')}</Body> : null}
        </View>
      }
      renderItem={({ item: n }) => (
        <Row
          title={n.title}
          image={n.cover}
          meta={dateLabel(n.publishedAt)}
          summary={n.summary}
          badges={
            n.pinned || n.membersOnly ? (
              <>
                {n.pinned ? <Badge label={t('news.pinned')} tone="strong" /> : null}
                {n.membersOnly ? <Badge label={t('news.membersOnly')} /> : null}
              </>
            ) : null
          }
          onPress={() => setOpen(n.id)}
        />
      )}
    />
  );
}

function ArticleView({
  id,
  userId,
  onBack,
}: {
  id: string;
  userId: string | null;
  onBack: () => void;
}) {
  const c = useTheme();
  const [a, setA] = useState<Article | null | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setA(await loadArticle(id));
    } catch {
      setA(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (a === undefined)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('nav.news')} onBack={onBack} />
        <ActivityIndicator />
      </View>
    );
  if (a === null)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('nav.news')} onBack={onBack} />
        <Body muted>{t('common.error')}</Body>
      </View>
    );

  const toggleLike = async () => {
    const next = !a.liked;
    setA({ ...a, liked: next, likes: a.likes + (next ? 1 : -1) });
    try {
      await setLike(a.id, next);
    } catch {
      void load();
    }
  };

  const send = async () => {
    setSending(true);
    try {
      await addComment(a.id, comment);
      setComment('');
      await load();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const remove = (commentId: string) =>
    Alert.alert(t('news.deleteComment'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('news.deleteComment'),
        style: 'destructive',
        onPress: () =>
          void deleteComment(commentId).then(load, () => Alert.alert(t('common.error'))),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={screenStyles.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('nav.news')} onBack={onBack} />
      <Title>{a.title}</Title>
      <Meta>
        {[
          dateLabel(a.publishedAt),
          a.author ? t('news.by', { name: a.author }) : null,
          a.membersOnly ? t('news.membersOnly') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Meta>
      {a.summary ? <Text style={[s.summary, { color: c.muted }]}>{a.summary}</Text> : null}
      {a.cover ? (
        <Image source={{ uri: a.cover }} style={screenStyles.hero} resizeMode="cover" />
      ) : null}
      <Markdown>{a.body}</Markdown>

      <View style={[s.likeRow, { borderColor: c.border }]}>
        <Text style={[s.likes, { color: c.muted }]}>{t('news.likes', { count: a.likes })}</Text>
        {userId ? (
          <Button
            label={a.liked ? t('news.liked') : t('news.like')}
            kind={a.liked ? 'primary' : 'secondary'}
            onPress={() => void toggleLike()}
            style={s.likeButton}
          />
        ) : null}
      </View>

      <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
        {t('news.comments')}
      </Text>
      {a.comments.length === 0 ? <Body muted>{t('news.noComments')}</Body> : null}
      {a.comments.map((cm) => (
        <View key={cm.id} style={[s.comment, { borderColor: c.border }]}>
          <Text style={[s.commentAuthor, { color: c.text }]}>
            {cm.author ?? '—'}{' '}
            <Text style={{ color: c.muted, fontWeight: '400' }}>· {dateLabel(cm.createdAt)}</Text>
          </Text>
          <Body>{cm.body}</Body>
          {userId && cm.authorId === userId ? (
            <Text
              accessibilityRole="button"
              onPress={() => remove(cm.id)}
              style={[s.delete, { color: c.danger }]}
            >
              {t('news.deleteComment')}
            </Text>
          ) : null}
        </View>
      ))}
      {!a.commentsEnabled ? (
        <Body muted>{t('news.commentsClosed')}</Body>
      ) : userId ? (
        <View style={{ marginTop: 8 }}>
          <TextInput
            accessibilityLabel={t('news.commentPlaceholder')}
            placeholder={t('news.commentPlaceholder')}
            placeholderTextColor={c.muted}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={2000}
            style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
          />
          <Meta>{t('news.commentRules')}</Meta>
          <Button
            label={t('news.commentSend')}
            busy={sending}
            disabled={!comment.trim()}
            onPress={() => void send()}
          />
        </View>
      ) : (
        <Body muted>{t('news.signIn')}</Body>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  summary: { fontSize: 18, lineHeight: 25, marginTop: 8 },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 8,
  },
  likes: { fontSize: 15 },
  likeButton: { minWidth: 130 },
  h2: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 4 },
  comment: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 2 },
  commentAuthor: { fontSize: 15, fontWeight: '700' },
  delete: { fontSize: 15, minHeight: 44, textAlignVertical: 'center', paddingTop: 10 },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
