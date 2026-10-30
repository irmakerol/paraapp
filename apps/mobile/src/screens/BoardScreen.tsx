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
  AD_CATEGORIES,
  AD_CONDITIONS,
  CURRENCIES,
  MAX_AD_PHOTOS,
  deleteAd,
  postAd,
  setAdStatus,
  type AdInput,
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
import { startDirectChat } from '../chats';
import { pickImage, type PreparedImage } from '../images';
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
  onChat,
  initial = 'notices',
}: {
  signedIn: boolean;
  /** The signed-in person (to post and manage their own notices). */
  userId?: string | null;
  onBack?: () => void;
  /** Opens the poster's profile (to follow or message them). */
  onPilot?: (id: string) => void;
  /** Opens a conversation in the Messages tab. */
  onChat?: (chatId: string) => void;
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
  const [selling, setSelling] = useState(false);
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

  if (selling && userId)
    return (
      <AdForm
        userId={userId}
        onBack={() => setSelling(false)}
        onPosted={() => {
          setSelling(false);
          setPosted(true);
          void load();
        }}
      />
    );
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
  if (openAd)
    return (
      <AdDetail
        ad={openAd}
        userId={userId}
        onBack={() => setOpenAd(null)}
        onChanged={() => {
          setOpenAd(null);
          void load();
        }}
        onChat={onChat}
      />
    );

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
      {section === 'market' && userId ? (
        <Button label={`＋ ${t('adForm.new')}`} onPress={() => setSelling(true)} />
      ) : null}
      {section === 'market' && posted ? <Body>{t('adForm.posted')}</Body> : null}
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
      <BackBar label={t('board.title')} onBack={onBack} />
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

function AdDetail({
  ad: a,
  userId,
  onBack,
  onChanged,
  onChat,
}: {
  ad: Ad;
  userId: string | null;
  onBack: () => void;
  onChanged: () => void;
  onChat?: (chatId: string) => void;
}) {
  const mine = Boolean(userId && userId === a.ownerId);
  const status = (next: 'active' | 'reserved' | 'sold') =>
    userId &&
    void setAdStatus(userId, a.id, next).then(onChanged, () => Alert.alert(t('common.error')));
  const c = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const contact = async () => {
    setBusy(true);
    setMessage(null);
    try {
      onChat?.(await startDirectChat(a.ownerId, a.id));
    } catch (e) {
      const key = e instanceof Error ? e.message : 'unavailable';
      setMessage(
        key === 'minor'
          ? t('chat.minorProtected')
          : key === 'blocked'
            ? t('chat.blockedNotice')
            : t('chat.unavailable'),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackBar label={t('board.title')} onBack={onBack} />
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
      {mine && userId ? (
        <>
          <Body muted>{t('adForm.yours')}</Body>
          {a.status === 'reserved' ? (
            <Button
              label={t('adForm.markActive')}
              kind="secondary"
              onPress={() => status('active')}
            />
          ) : (
            <Button
              label={t('adForm.markReserved')}
              kind="secondary"
              onPress={() => status('reserved')}
            />
          )}
          <Button label={t('adForm.markSold')} kind="secondary" onPress={() => status('sold')} />
          <Button
            label={t('adForm.delete')}
            kind="danger"
            onPress={() =>
              Alert.alert(t('adForm.deleteConfirm'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('adForm.delete'),
                  style: 'destructive',
                  onPress: () =>
                    void deleteAd(userId, a.id).then(onChanged, () =>
                      Alert.alert(t('common.error')),
                    ),
                },
              ])
            }
          />
        </>
      ) : userId && onChat ? (
        <Button label={t('board.contactSeller')} busy={busy} onPress={() => void contact()} />
      ) : null}
      {message ? <Body muted>{message}</Body> : null}
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
  label: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  photoButtons: { flexDirection: 'row', gap: 10 },
  adThumb: { width: 96, height: 96, borderRadius: 10 },
  removeX: { position: 'absolute', top: 2, right: 6, fontSize: 18, fontWeight: '800' },
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
  const c = useTheme();
  const [sites, setSites] = useState<Site[]>([]);
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const choose = async (source: 'library' | 'camera') => {
    try {
      const picked = await pickImage(source);
      if (picked) setPhoto(picked);
    } catch {
      Alert.alert(t('noticeForm.photoError'));
    }
  };
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
      await postNotice(userId, form, photo);
      onPosted();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMessage(
        code === '42501'
          ? t('noticeForm.adultsOnly')
          : e instanceof Error && e.message === 'photo'
            ? t('noticeForm.photoError')
            : t('common.error'),
      );
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
      <Text style={[s.label, { color: c.text }]}>{t('noticeForm.photo')}</Text>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" />
          <Button
            label={t('noticeForm.removePhoto')}
            kind="secondary"
            onPress={() => setPhoto(null)}
          />
        </>
      ) : (
        <View style={s.photoButtons}>
          <Button
            label={t('noticeForm.addPhoto')}
            kind="secondary"
            onPress={() => void choose('library')}
            style={{ flex: 1 }}
          />
          <Button
            label={t('noticeForm.takePhoto')}
            kind="secondary"
            onPress={() => void choose('camera')}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <Body muted>{t('noticeForm.photoNote')}</Body>
      <Button label={t('noticeForm.submit')} busy={busy} onPress={() => void submit()} />
      {message ? <Body>{message}</Body> : null}
    </ScrollView>
  );
}

function AdForm({
  userId,
  onBack,
  onPosted,
}: {
  userId: string;
  onBack: () => void;
  onPosted: () => void;
}) {
  const c = useTheme();
  const [form, setForm] = useState<AdInput>({
    title: '',
    category: 'wing',
    brand: '',
    model: '',
    size: '',
    condition: 'good',
    price: '',
    currency: 'TRY',
    city: '',
    description: '',
  });
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof AdInput>(key: K, value: AdInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const add = async (source: 'library' | 'camera') => {
    try {
      const picked = await pickImage(source);
      if (picked) setPhotos((p) => [...p, picked].slice(0, MAX_AD_PHOTOS));
    } catch {
      Alert.alert(t('noticeForm.photoError'));
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    const title = form.title.trim();
    if (title.length < 3 || title.length > 120) next.title = t('adForm.titleInvalid');
    const price = Number(form.price.replace(',', '.'));
    if (!form.price.trim() || !Number.isFinite(price) || price < 0)
      next.price = t('adForm.priceInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setMessage(null);
    try {
      await postAd(userId, form, photos);
      onPosted();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMessage(
        code === '42501'
          ? t('adForm.adultsOnly')
          : e instanceof Error && e.message === 'photo'
            ? t('noticeForm.photoError')
            : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('board.market')} onBack={onBack} />
      <Title>{t('adForm.title')}</Title>
      <Field
        label={t('adForm.heading')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        maxLength={120}
        error={errors.title}
      />
      <Chips
        label={t('adForm.category')}
        options={AD_CATEGORIES.map((cat) => ({
          value: cat,
          label: t(`board.adCategories.${cat}`),
        }))}
        value={form.category}
        onChange={(v) => v && set('category', v)}
      />
      <Field
        label={t('adForm.brand')}
        value={form.brand}
        onChangeText={(v) => set('brand', v)}
        maxLength={60}
      />
      <Field
        label={t('adForm.model')}
        value={form.model}
        onChangeText={(v) => set('model', v)}
        maxLength={80}
      />
      <Field
        label={t('adForm.size')}
        value={form.size}
        onChangeText={(v) => set('size', v)}
        maxLength={20}
      />
      <Chips
        label={t('adForm.condition')}
        options={AD_CONDITIONS.map((cond) => ({
          value: cond,
          label: t(`board.conditions.${cond}`),
        }))}
        value={form.condition}
        onChange={(v) => v && set('condition', v)}
      />
      <Field
        label={t('adForm.price')}
        value={form.price}
        onChangeText={(v) => set('price', v)}
        keyboardType="decimal-pad"
        maxLength={12}
        error={errors.price}
      />
      <Segmented
        label={t('adForm.currency')}
        options={CURRENCIES.map((cur) => ({ value: cur, label: cur }))}
        value={form.currency}
        onChange={(v) => set('currency', v)}
      />
      <Field
        label={t('adForm.city')}
        value={form.city}
        onChangeText={(v) => set('city', v)}
        maxLength={80}
      />
      <Field
        label={t('adForm.description')}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        maxLength={5000}
        multiline
      />
      <Text style={[s.label, { color: c.text }]}>{t('adForm.photos')}</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {photos.map((p, i) => (
          <Pressable
            key={p.uri}
            accessibilityRole="button"
            accessibilityLabel={t('noticeForm.removePhoto')}
            onPress={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
          >
            <Image source={{ uri: p.uri }} style={s.adThumb} />
            <Text style={[s.removeX, { color: c.danger }]}>✕</Text>
          </Pressable>
        ))}
      </ScrollView>
      {photos.length < MAX_AD_PHOTOS ? (
        <View style={s.photoButtons}>
          <Button
            label={t('noticeForm.addPhoto')}
            kind="secondary"
            onPress={() => void add('library')}
            style={{ flex: 1 }}
          />
          <Button
            label={t('noticeForm.takePhoto')}
            kind="secondary"
            onPress={() => void add('camera')}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      <Body muted>{t('noticeForm.photoNote')}</Body>
      <Button label={t('adForm.submit')} busy={busy} onPress={() => void submit()} />
      {message ? <Body>{message}</Body> : null}
    </ScrollView>
  );
}
