import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  NOTICE_CATEGORIES,
  NOTICE_KINDS,
  closeNotice,
  deleteNotice,
  listAds,
  listNotices,
  money,
  postNotice,
  type Ad,
  type Notice,
  type NoticeInput,
} from '../board';
import { listSites, type Site } from '../sites';
import { Badge, Body, Button, Chips, Field, Segmented, Stepper, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { BackBar } from '../ui/screen';

type Section = 'notices' | 'market';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

/** "Duyurular": the notice board and the gear market, as on the website's notices page. */
export function BoardScreen({
  signedIn,
  userId = null,
  onBack,
  onPilot,
  initial = 'notices',
}: {
  signedIn: boolean;
  /** The signed-in person (to post and manage their own notices). */
  userId?: string | null;
  onBack?: () => void;
  /** Opens the poster's profile (to follow or message them). */
  onPilot?: (id: string) => void;
  initial?: Section;
}) {
  const c = useTheme();
  const [section, setSection] = useState<Section>(initial);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const [openAd, setOpenAd] = useState<Ad | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

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

  if (posting && userId)
    return (
      <NoticeForm
        userId={userId}
        onBack={() => setPosting(false)}
        onPosted={() => {
          setPosting(false);
          setPosted(true);
          void load();
        }}
      />
    );
  if (openNotice)
    return (
      <NoticeDetail
        notice={openNotice}
        userId={userId}
        onBack={() => setOpenNotice(null)}
        onChanged={() => {
          setOpenNotice(null);
          void load();
        }}
        onPilot={onPilot}
      />
    );
  if (openAd) return <AdDetail ad={openAd} onBack={() => setOpenAd(null)} />;

  const header = (
    <View>
      {onBack ? <BackBar onBack={onBack} /> : null}
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
      {section === 'notices' && userId ? (
        <Button label={`＋ ${t('noticeForm.new')}`} onPress={() => setPosting(true)} />
      ) : null}
      {section === 'notices' && posted ? <Body>{t('noticeForm.posted')}</Body> : null}
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

function NoticeDetail({
  notice: n,
  userId,
  onBack,
  onChanged,
  onPilot,
}: {
  notice: Notice;
  userId: string | null;
  onBack: () => void;
  onChanged: () => void;
  onPilot?: (id: string) => void;
}) {
  const mine = Boolean(userId && userId === n.userId);
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
      {onPilot ? (
        <Button
          label={`${t('pilots.message')} · ${n.author ?? ''}`}
          onPress={() => onPilot(n.userId)}
        />
      ) : null}
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

function NoticeForm({
  userId,
  onBack,
  onPosted,
}: {
  userId: string;
  onBack: () => void;
  onPosted: () => void;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<NoticeInput>({
    kind: 'offer',
    category: 'transport',
    title: '',
    body: '',
    siteId: null,
    place: '',
    date: '',
    seats: 1,
    price: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listSites().then(setSites, () => undefined);
  }, []);
  const set = <K extends keyof NoticeInput>(key: K, value: NoticeInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const next: Record<string, string> = {};
    const title = form.title.trim();
    if (title.length < 3 || title.length > 120) next.title = t('noticeForm.titleInvalid');
    if (form.date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim()))
      next.date = t('noticeForm.dateInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setMessage(null);
    try {
      await postNotice(userId, form);
      onPosted();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMessage(code === '42501' ? t('noticeForm.adultsOnly') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('board.title')} onBack={onBack} />
      <Title>{t('noticeForm.title')}</Title>
      <Segmented
        label={t('noticeForm.kind')}
        options={NOTICE_KINDS.map((k) => ({ value: k, label: t(`board.kinds.${k}`) }))}
        value={form.kind}
        onChange={(v) => set('kind', v)}
      />
      <Chips
        label={t('noticeForm.category')}
        options={NOTICE_CATEGORIES.map((cat) => ({
          value: cat,
          label: t(`board.categories.${cat}`),
        }))}
        value={form.category}
        onChange={(v) => v && set('category', v)}
      />
      <Field
        label={t('noticeForm.heading')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        maxLength={120}
        error={errors.title}
      />
      <Field
        label={t('noticeForm.body')}
        value={form.body}
        onChangeText={(v) => set('body', v)}
        maxLength={2000}
        multiline
      />
      <Chips
        label={t('noticeForm.site')}
        options={[
          { value: null, label: t('noticeForm.noSite') },
          ...sites.map((site) => ({ value: site.id, label: site.name })),
        ]}
        value={form.siteId}
        onChange={(v) => set('siteId', v)}
      />
      <Field
        label={t('noticeForm.place')}
        value={form.place}
        onChangeText={(v) => set('place', v)}
        maxLength={120}
      />
      <Field
        label={t('noticeForm.date')}
        value={form.date}
        onChangeText={(v) => set('date', v)}
        placeholder="2026-11-02"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={errors.date}
      />
      {form.category === 'transport' ? (
        <Stepper
          label={t('noticeForm.seats')}
          value={String(form.seats)}
          onStep={(d) => set('seats', Math.max(1, Math.min(8, form.seats + d)))}
          canDown={form.seats > 1}
          canUp={form.seats < 8}
        />
      ) : null}
      <Field
        label={t('noticeForm.price')}
        value={form.price}
        onChangeText={(v) => set('price', v)}
        keyboardType="decimal-pad"
        maxLength={12}
      />
      <Body muted>{t('noticeForm.photoOnWeb')}</Body>
      <Button label={t('noticeForm.submit')} busy={busy} onPress={() => void submit()} />
      {message ? <Body>{message}</Body> : null}
    </ScrollView>
  );
}
