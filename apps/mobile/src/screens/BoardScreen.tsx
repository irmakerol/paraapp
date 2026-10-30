import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { locale, t, type MessageKey } from '../i18n';
import { listAds, listNotices, money, type Ad, type Notice } from '../board';
import { Badge, Body, Button, Segmented, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';

type Section = 'notices' | 'market';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

/** "Duyurular": the notice board and the gear market, as on the website's notices page. */
export function BoardScreen({ signedIn }: { signedIn: boolean }) {
  const c = useTheme();
  const [section, setSection] = useState<Section>('notices');
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const [openAd, setOpenAd] = useState<Ad | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [n, a] = await Promise.all([signedIn ? listNotices() : Promise.resolve([]), listAds()]);
      setNotices(n);
      setAds(a);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (openNotice) return <NoticeDetail notice={openNotice} onBack={() => setOpenNotice(null)} />;
  if (openAd) return <AdDetail ad={openAd} onBack={() => setOpenAd(null)} />;

  const header = (
    <View>
      <Title>{t('board.title')}</Title>
      <Segmented
        label={t('board.show')}
        options={[
          { value: 'notices', label: t('board.notices') },
          { value: 'market', label: t('board.market') },
        ]}
        value={section}
        onChange={setSection}
      />
      {failed ? <Body muted>{t('common.offline')}</Body> : null}
      {busy && !notices && !ads ? <ActivityIndicator /> : null}
      {section === 'notices' && !signedIn ? <Body muted>{t('board.signIn')}</Body> : null}
      {section === 'notices' && signedIn && notices?.length === 0 ? (
        <Body muted>{t('board.noNotices')}</Body>
      ) : null}
      {section === 'market' && ads?.length === 0 ? <Body muted>{t('board.noAds')}</Body> : null}
    </View>
  );

  const card = (onPress: () => void, children: React.ReactNode, key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.item,
        { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );

  if (section === 'notices') {
    return (
      <FlatList
        contentContainerStyle={s.page}
        data={notices ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
        ListHeaderComponent={header}
        renderItem={({ item: n }) =>
          card(
            () => setOpenNotice(n),
            <>
              <View style={s.badges}>
                <Badge
                  label={t(`board.kinds.${n.kind}`)}
                  tone={n.kind === 'offer' ? 'strong' : 'neutral'}
                />
                <Badge label={t(`board.categories.${n.category}` as MessageKey)} />
              </View>
              <Text style={[s.itemTitle, { color: c.text }]}>{n.title}</Text>
              <Text style={[s.itemMeta, { color: c.muted }]}>
                {[n.site ?? n.place, n.date ? day(n.date) : null, n.author]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </>,
            n.id,
          )
        }
      />
    );
  }
  return (
    <FlatList
      contentContainerStyle={s.page}
      data={ads ?? []}
      keyExtractor={(a) => a.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={header}
      renderItem={({ item: a }) =>
        card(
          () => setOpenAd(a),
          <View style={s.adRow}>
            {a.photos[0] ? (
              <Image
                source={{ uri: a.photos[0] }}
                style={s.thumb}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[s.thumb, { backgroundColor: c.border }]} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.itemTitle, { color: c.text }]} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={[s.price, { color: c.text }]}>{money(a.price, a.currency, locale)}</Text>
              <Text style={[s.itemMeta, { color: c.muted }]}>
                {[t(`board.adCategories.${a.category}` as MessageKey), a.city]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {a.status === 'reserved' ? <Badge label={t('board.reserved')} /> : null}
            </View>
          </View>,
          a.id,
        )
      }
    />
  );
}

function NoticeDetail({ notice: n, onBack }: { notice: Notice; onBack: () => void }) {
  const c = useTheme();
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Button label={t('flights.back')} kind="secondary" onPress={onBack} />
      <View style={s.badges}>
        <Badge
          label={t(`board.kinds.${n.kind}`)}
          tone={n.kind === 'offer' ? 'strong' : 'neutral'}
        />
        <Badge label={t(`board.categories.${n.category}` as MessageKey)} />
      </View>
      <Title>{n.title}</Title>
      {n.photoUrl ? (
        <Image source={{ uri: n.photoUrl }} style={s.photo} resizeMode="cover" />
      ) : null}
      {n.body ? <Body>{n.body}</Body> : null}
      <View style={[s.facts, { borderColor: c.border }]}>
        {n.site || n.place ? (
          <Fact label={t('board.where')} value={(n.site ?? n.place) as string} />
        ) : null}
        {n.date ? <Fact label={t('board.when')} value={day(n.date)} /> : null}
        {n.seats != null ? <Fact label={t('board.seats')} value={String(n.seats)} /> : null}
        {n.price != null ? (
          <Fact label={t('board.price')} value={money(n.price, n.currency ?? 'TRY', locale)} />
        ) : null}
        {n.author ? <Fact label={t('board.postedBy')} value={n.author} /> : null}
        <Fact label={t('board.posted')} value={day(n.createdAt)} />
      </View>
    </ScrollView>
  );
}

function AdDetail({ ad: a, onBack }: { ad: Ad; onBack: () => void }) {
  const c = useTheme();
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Button label={t('flights.back')} kind="secondary" onPress={onBack} />
      <Title>{a.title}</Title>
      <Text style={[s.bigPrice, { color: c.text }]}>{money(a.price, a.currency, locale)}</Text>
      {a.photos.length ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {a.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={s.photoPage} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}
      <View style={[s.facts, { borderColor: c.border }]}>
        <Fact
          label={t('board.category')}
          value={t(`board.adCategories.${a.category}` as MessageKey)}
        />
        {a.brand || a.model ? (
          <Fact
            label={t('board.model')}
            value={[a.brand, a.model, a.size].filter(Boolean).join(' ')}
          />
        ) : null}
        <Fact
          label={t('board.condition')}
          value={t(`board.conditions.${a.condition}` as MessageKey)}
        />
        {a.city ? <Fact label={t('board.where')} value={a.city} /> : null}
        <Fact label={t('board.posted')} value={day(a.createdAt)} />
      </View>
      {a.description ? <Body>{a.description}</Body> : null}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={s.fact}>
      <Text style={[s.factLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[s.factValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 8, paddingBottom: 40 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemTitle: { fontSize: 17, fontWeight: '600' },
  itemMeta: { fontSize: 15 },
  adRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 84, height: 84, borderRadius: 10 },
  price: { fontSize: 17, fontWeight: '800' },
  bigPrice: { fontSize: 26, fontWeight: '800' },
  photo: { width: '100%', height: 220, borderRadius: 14 },
  photoPage: { width: 340, height: 240, borderRadius: 14, marginRight: 8 },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  factLabel: { fontSize: 16 },
  factValue: { fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
