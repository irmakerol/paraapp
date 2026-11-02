import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { useTheme } from './theme';

/** Back link at the top of a section opened from the home screen or a list. */
export function BackBar({ label, onBack }: { label?: string; onBack: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nav.back')}
      onPress={onBack}
      hitSlop={8}
      style={s.back}
    >
      <Text style={[s.backText, { color: c.primary }]}>‹ {label ?? t('nav.back')}</Text>
    </Pressable>
  );
}

/** One tappable row in a content list (news, Ground School, events, trips…). */
export function Row({
  title,
  meta,
  summary,
  image,
  badges,
  struck = false,
  onPress,
}: {
  title: string;
  meta?: string | null;
  summary?: string | null;
  image?: string | null;
  badges?: ReactNode;
  struck?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={s.cover}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={s.rowBody}>
        {badges ? <View style={s.badges}>{badges}</View> : null}
        <Text
          style={[s.rowTitle, { color: c.text }, struck && { textDecorationLine: 'line-through' }]}
        >
          {title}
        </Text>
        {meta ? <Text style={[s.meta, { color: c.muted }]}>{meta}</Text> : null}
        {summary ? (
          <Text style={[s.summary, { color: c.text }]} numberOfLines={3}>
            {summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[s.meta, { color: c.muted }]}>{children}</Text>;
}

export function Fact({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={s.fact}>
      <Text style={[s.factLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[s.factValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginVertical: 8 },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 8 },
});

const s = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 6,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 2 },
  rowBody: { padding: 14, gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowTitle: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 14, lineHeight: 19 },
  summary: { fontSize: 15, lineHeight: 21 },
  fact: { paddingVertical: 8 },
  factLabel: { fontSize: 13, fontWeight: '600' },
  factValue: { fontSize: 16, marginTop: 2 },
});
