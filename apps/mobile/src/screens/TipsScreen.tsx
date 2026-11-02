import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { t } from '../i18n';
import {
  DIFFICULTIES,
  TIP_CATEGORIES,
  dateLabel,
  listTips,
  loadTip,
  setSaved,
  videoLink,
  type Difficulty,
  type Tip,
  type TipCategory,
  type TipItem,
} from '../content';
import { Badge, Body, Button, Title } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Meta, Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

type Filter = TipCategory | 'all' | 'saved';

/** "Yer Okulu" (Ground School): lessons by instructors, filterable like on the website. */
export function TipsScreen({ userId, onBack }: { userId: string | null; onBack: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [level, setLevel] = useState<Difficulty | null>(null);
  const [items, setItems] = useState<TipItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(
        await listTips({
          saved: filter === 'saved',
          category: filter === 'all' || filter === 'saved' ? null : filter,
          difficulty: level,
        }),
      );
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [filter, level]);

  useEffect(() => {
    void load();
  }, [load, userId]);

  if (open)
    return (
      <TipView
        id={open}
        userId={userId}
        onBack={() => {
          setOpen(null);
          if (filter === 'saved') void load();
        }}
      />
    );

  const categories: { value: Filter; label: string }[] = [
    { value: 'all', label: t('tips.all') },
    ...(userId ? [{ value: 'saved' as Filter, label: t('tips.saved') }] : []),
    ...TIP_CATEGORIES.map((cat) => ({ value: cat as Filter, label: t(`tips.categories.${cat}`) })),
  ];
  const levels: { value: Difficulty | null; label: string }[] = [
    { value: null, label: t('tips.allLevels') },
    ...DIFFICULTIES.map((d) => ({ value: d, label: t(`tips.difficulty.${d}`) })),
  ];

  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={items ?? []}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <BackBar onBack={onBack} />
          <Title>{t('nav.tips')}</Title>
          <Body muted>{t('tips.lead')}</Body>
          <ChipRow
            label={t('tips.category')}
            options={categories}
            value={filter}
            onChange={setFilter}
          />
          {filter !== 'saved' ? (
            <ChipRow label={t('tips.level')} options={levels} value={level} onChange={setLevel} />
          ) : null}
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !items ? <ActivityIndicator /> : null}
          {items?.length === 0 ? (
            <Body muted>{filter === 'saved' ? t('tips.noSaved') : t('tips.empty')}</Body>
          ) : null}
        </View>
      }
      ListFooterComponent={
        <View style={{ marginTop: 12 }}>
          <Meta>{t('tips.safety')}</Meta>
        </View>
      }
      renderItem={({ item }) => (
        <Row
          title={item.title}
          summary={item.summary}
          badges={
            <>
              <Badge label={t(`tips.categories.${item.category}`)} tone="strong" />
              <Badge label={t(`tips.difficulty.${item.difficulty}`)} />
              {item.hasVideo ? <Badge label={`▶ ${t('tips.video')}`} /> : null}
            </>
          }
          onPress={() => setOpen(item.id)}
        />
      )}
    />
  );
}

/** A horizontally scrolling row of filter chips. */
export function ChipRow<T extends string | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={s.chips}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              s.chip,
              {
                borderColor: active ? c.primary : c.border,
                backgroundColor: active ? c.primary : c.card,
              },
            ]}
          >
            <Text style={[s.chipText, { color: active ? c.primaryText : c.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TipView({
  id,
  userId,
  onBack,
}: {
  id: string;
  userId: string | null;
  onBack: () => void;
}) {
  const c = useTheme();
  const [tip, setTip] = useState<Tip | null | undefined>(undefined);

  useEffect(() => {
    loadTip(id).then(setTip, () => setTip(null));
  }, [id]);

  if (!tip)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('nav.tips')} onBack={onBack} />
        {tip === undefined ? <ActivityIndicator /> : <Body muted>{t('common.error')}</Body>}
      </View>
    );

  const video = videoLink(tip.videoUrl);
  const toggle = async () => {
    const next = !tip.saved;
    setTip({ ...tip, saved: next });
    try {
      await setSaved(tip.id, next);
    } catch {
      setTip({ ...tip, saved: !next });
    }
  };

  return (
    <ScrollView contentContainerStyle={screenStyles.page}>
      <BackBar label={t('nav.tips')} onBack={onBack} />
      <View style={s.badges}>
        <Badge label={t(`tips.categories.${tip.category}`)} tone="strong" />
        <Badge label={t(`tips.difficulty.${tip.difficulty}`)} />
      </View>
      <Title>{tip.title}</Title>
      <Meta>{[dateLabel(tip.publishedAt), tip.author].filter(Boolean).join(' · ')}</Meta>
      {tip.summary ? <Text style={[s.summary, { color: c.muted }]}>{tip.summary}</Text> : null}
      {video ? (
        <View style={[s.video, { borderColor: c.border, backgroundColor: c.card }]}>
          <Button label={`▶ ${t('tips.watch')}`} onPress={() => void Linking.openURL(video)} />
          <Meta>{t('tips.watchNotice')}</Meta>
        </View>
      ) : null}
      <Markdown>{tip.body}</Markdown>
      <View style={[s.safety, { borderColor: c.border }]}>
        <Meta>{t('tips.safety')}</Meta>
      </View>
      {userId ? (
        <Button
          label={tip.saved ? t('tips.unsave') : t('tips.save')}
          kind={tip.saved ? 'primary' : 'secondary'}
          onPress={() => void toggle()}
        />
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chips: { gap: 8, paddingVertical: 8 },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  summary: { fontSize: 18, lineHeight: 25, marginTop: 8 },
  video: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
  },
  safety: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 8 },
});
