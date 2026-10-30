import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { locale, t, type Locale, type MessageKey } from '../i18n';
import { signOut } from '../auth';
import {
  LICENCE_BODIES,
  PILOT_LEVELS,
  PRIVACY_FIELDS,
  PROFILE_COUNTRIES,
  SPEED_UNITS,
  UNIT_SYSTEMS,
  VISIBILITIES,
  deleteMyAccount,
  flag,
  loadLicence,
  loadMyProfile,
  saveLocale,
  saveMyProfile,
  setAvatar,
  trainingLevelOptions,
  type MyProfile,
  type ProfileEdit,
  type Units,
} from '../profile';
import { pickImage } from '../images';
import { VarioAudio } from '../tracker/vario-audio';
import { VOLUME_LEVEL } from '../tracker/vario-settings';
import { useVarioSettings } from '../tracker/vario-settings-store';
import { Body, Button, Card, Chips, Field, Link, Segmented, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { ProfileBadges } from '../ui/badges';
import { VarioSettingsScreen } from './VarioSettingsScreen';

export function levelLabel(level: string) {
  if (level === 'student' || level === 'tandem' || level === 'instructor')
    return t(`profile.levels.${level}`);
  return /^t\d$/.test(level)
    ? t('profile.tandemLevel', { level: level.toUpperCase() })
    : t('profile.pilotLevel', { level: level.toUpperCase() });
}

/** The signed-in pilot's own profile, settings and account, all inside the app. */
export function ProfileScreen({
  session,
  onLocaleChange,
}: {
  session: Session;
  onLocaleChange: (l: Locale) => void;
}) {
  const c = useTheme();
  const userId = session.user.id;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditSection | null>(null);
  const [licence, setLicence] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [vario, setVario] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const settings = useVarioSettings();
  const audio = useRef(new VarioAudio());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await loadMyProfile(userId));
      setFailed(null);
    } catch (e) {
      // Shown in small print so a tester can tell us what went wrong.
      setFailed(
        e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e),
      );
    } finally {
      setLoading(false);
    }
    // The licence number comes from the website; the profile never waits for it.
    void loadLicence().then((l) => {
      if (l !== null) setLicence(l);
    });
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmDelete() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void deleteMyAccount()
            .then(async (ok) => {
              if (!ok) {
                Alert.alert(t('common.error'));
                return;
              }
              Alert.alert(t('profile.deleted'));
              await signOut();
            })
            .finally(() => setDeleting(false));
        },
      },
    ]);
  }

  if (!profile) {
    return (
      <View style={s.center}>
        {failed !== null ? (
          <>
            <Body muted>{t('common.offline')}</Body>
            <Text style={[s.errorDetail, { color: c.muted }]}>{failed}</Text>
            <Button label={t('profile.retry')} kind="secondary" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const years =
    profile.flyingSince != null
      ? Math.max(0, new Date().getFullYear() - profile.flyingSince)
      : null;
  const isStudent = profile.roles.includes('student_pilot');

  function changePhoto() {
    const run = (job: () => Promise<void>) => {
      setPhotoBusy(true);
      job()
        .then(load)
        .catch(() => Alert.alert(t('profile.photoError')))
        .finally(() => setPhotoBusy(false));
    };
    const pick = (source: 'library' | 'camera') =>
      run(async () => {
        const photo = await pickImage(source, 800);
        if (photo) await setAvatar(userId, photo, profile?.avatarPath ?? null);
      });
    Alert.alert(t('profile.photo'), undefined, [
      { text: t('profile.choosePhoto'), onPress: () => pick('library') },
      { text: t('profile.takePhoto'), onPress: () => pick('camera') },
      ...(profile?.avatarPath
        ? [
            {
              text: t('profile.removePhoto'),
              style: 'destructive' as const,
              onPress: () => run(() => setAvatar(userId, null, profile.avatarPath)),
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={s.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Card style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('profile.photo')}: ${t('profile.change')}`}
          onPress={changePhoto}
          style={({ pressed }) => [s.avatarWrap, { opacity: pressed ? 0.7 : 1 }]}
        >
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.initials, { backgroundColor: c.primary }]}>
              <Text style={[s.initialsText, { color: c.primaryText }]}>
                {profile.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[s.camera, { backgroundColor: c.card, borderColor: c.border }]}>
            {photoBusy ? <ActivityIndicator /> : <Text style={s.cameraIcon}>📷</Text>}
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Title>{profile.displayName}</Title>
          {profile.fullName ? <Body muted>{profile.fullName}</Body> : null}
          {session.user.email ? <Body muted>{session.user.email}</Body> : null}
        </View>
      </Card>
      <View style={s.badges}>
        <ProfileBadges
          roles={profile.roles}
          level={profile.pilotLevel}
          trainingLevel={profile.trainingLevel}
          instructor={profile.isInstructor}
        />
      </View>
      {profile.isMinor ? <Body muted>{t('profile.minorNote')}</Body> : null}

      <View style={s.tiles}>
        <Tile
          value={String(Math.round(profile.totalHours * 10) / 10)}
          label={t('flights.totalHours')}
        />
        <Tile value={String(profile.totalFlights)} label={t('flights.totalFlights')} />
        <Tile value={years != null ? String(years) : '—'} label={t('profile.yearsFlying')} />
      </View>

      <Section title={t('profile.sections.personal')} onEdit={() => setEditing('personal')}>
        <Row label={t('profile.fullName')} value={profile.fullName || '—'} />
        <Row
          label={t('profile.country')}
          value={profile.country ? `${flag(profile.country)} ${profile.country}` : '—'}
        />
        <Row label={t('profile.city')} value={profile.city || '—'} />
        <Row
          label={t('profile.memberSince')}
          value={new Date(profile.createdAt).toLocaleDateString(
            locale === 'tr' ? 'tr-TR' : 'en-GB',
            { month: 'long', year: 'numeric' },
          )}
        />
        {profile.bio ? <Body>{profile.bio}</Body> : null}
      </Section>

      <Section title={t('profile.sections.flying')} onEdit={() => setEditing('flying')}>
        <Row
          label={t('profile.level')}
          value={profile.pilotLevel ? levelLabel(profile.pilotLevel) : '—'}
        />
        {isStudent && profile.trainingLevel ? (
          <Row label={t('profile.trainingLevel')} value={levelLabel(profile.trainingLevel)} />
        ) : null}
        <Row
          label={t('profile.licenceBody')}
          value={
            profile.licenceBody
              ? t(`profile.licenceBodies.${profile.licenceBody}` as MessageKey)
              : '—'
          }
        />
        <Row label={t('profile.licence')} value={licence || '—'} />
        <Row label={t('profile.flyingSince')} value={profile.flyingSince?.toString() ?? '—'} />
        <Row label={t('profile.homeSite')} value={profile.homeSite || '—'} />
        <Row label={t('profile.wings')} value={profile.wings || '—'} />
        <Row
          label={t('profile.weight')}
          value={profile.weightKg != null ? String(profile.weightKg) : '—'}
        />
      </Section>

      <Section title={t('profile.sections.privacy')} onEdit={() => setEditing('privacy')}>
        {PRIVACY_FIELDS.map((f) => (
          <Row
            key={f}
            label={t(`profile.privacyFields.${f}`)}
            value={t(`profile.visibility.${profile.privacy[f]}`)}
          />
        ))}
      </Section>

      <Title>{t('profile.settings')}</Title>
      <Card>
        <Segmented
          label={t('profile.language')}
          options={[
            { value: 'tr', label: 'Türkçe' },
            { value: 'en', label: 'English' },
          ]}
          value={locale}
          onChange={(l: Locale) => {
            void saveLocale(userId, l);
            onLocaleChange(l);
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditing('units')}
          style={({ pressed }) => [s.linkRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[s.rowLabel, { color: c.text }]}>{t('profile.sections.units')}</Text>
          <Text style={[s.rowValue, { color: c.muted }]}>
            {t(`profile.unitSystem.${profile.units.system}`)} · {speedLabel(profile.units.speed)} ›
          </Text>
        </Pressable>
        <Button label={t('vario.open')} kind="secondary" onPress={() => setVario(true)} />
      </Card>

      <Button label={t('account.signOut')} kind="secondary" onPress={() => void signOut()} />
      <Link label={t('profile.deleteAccount')} onPress={confirmDelete} />
      {deleting ? <ActivityIndicator /> : null}
      <View style={{ height: 12 }} />
      <Body muted>
        {t('account.version', {
          v: `${Constants.expoConfig?.version ?? ''} (${Constants.expoConfig?.ios?.buildNumber ?? ''})`,
        })}
      </Body>
      <Body muted>{t('account.testBuild')}</Body>

      <EditProfile
        section={editing}
        profile={profile}
        licence={licence}
        onClose={() => setEditing(null)}
        onSave={async (edit) => {
          await saveMyProfile(userId, edit);
          setEditing(null);
          await load();
        }}
      />
      <VarioSettingsScreen
        visible={vario}
        onClose={() => setVario(false)}
        onTest={async () => {
          audio.current.configure({
            climbStart: settings.climbStart,
            sinkAlarm: settings.sinkAlarm,
            volume: VOLUME_LEVEL[settings.volume],
          });
          await audio.current.demo();
        }}
      />
    </ScrollView>
  );
}

const speedLabel = (u: Units['speed']) => (u === 'kmh' ? 'km/h' : u === 'ms' ? 'm/s' : u);

type EditSection = 'personal' | 'flying' | 'privacy' | 'units';

/** A card with a big tappable header that opens that part of the profile for editing. */
function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${t('profile.change')}`}
        onPress={onEdit}
        style={({ pressed }) => [s.sectionHead, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[s.sectionTitle, { color: c.text }]}>{title}</Text>
        <Text style={[s.sectionEdit, { color: c.primary }]}>{t('profile.change')} ›</Text>
      </Pressable>
      {children}
    </Card>
  );
}

/** Text → number, or null when empty; undefined when it is not a valid number in range. */
function parseNumber(text: string, min: number, max: number, integer: boolean) {
  const v = text.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
    return undefined;
  return n;
}

function EditProfile({
  section,
  profile,
  licence,
  onClose,
  onSave,
}: {
  section: EditSection | null;
  profile: MyProfile;
  licence: string;
  onClose: () => void;
  onSave: (edit: ProfileEdit) => Promise<void>;
}) {
  const c = useTheme();
  const isStudent = profile.roles.includes('student_pilot');
  const initial = (): ProfileEdit => ({
    displayName: profile.displayName,
    fullName: profile.fullName,
    country: profile.country,
    city: profile.city,
    homeSite: profile.homeSite,
    pilotLevel: profile.pilotLevel === 'instructor' ? null : profile.pilotLevel,
    flyingSince: profile.flyingSince,
    wings: profile.wings,
    weightKg: profile.weightKg,
    totalHours: profile.totalHours,
    totalFlights: profile.totalFlights,
    bio: profile.bio,
    licenceBody: profile.licenceBody,
    privacy: profile.privacy,
    units: profile.units,
    ...(isStudent ? { trainingLevel: profile.trainingLevel } : {}),
  });
  const [edit, setEdit] = useState<ProfileEdit>(initial);
  const [text, setText] = useState({ since: '', weight: '', hours: '', flights: '', licence: '' });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (section) {
      setEdit(initial());
      setText({
        since: profile.flyingSince?.toString() ?? '',
        weight: profile.weightKg?.toString() ?? '',
        hours: String(profile.totalHours),
        flights: String(profile.totalFlights),
        licence,
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [section]);

  const set = <K extends keyof ProfileEdit>(key: K, value: ProfileEdit[K]) =>
    setEdit((e) => ({ ...e, [key]: value }));
  const setTextField = (key: keyof typeof text) => (v: string) =>
    setText((cur) => ({ ...cur, [key]: v }));

  async function save() {
    const next: Record<string, string> = {};
    const name = edit.displayName.trim();
    if (name.length < 2 || name.length > 40) next.displayName = t('profile.nameInvalid');
    const year = parseNumber(text.since, 1950, new Date().getFullYear(), true);
    if (year === undefined) next.flyingSince = t('profile.yearInvalid');
    const weight = parseNumber(text.weight, 30, 250, true);
    if (weight === undefined) next.weight = t('profile.numberInvalid');
    const hours = parseNumber(text.hours, 0, 100000, false);
    if (hours === undefined) next.hours = t('profile.numberInvalid');
    const flights = parseNumber(text.flights, 0, 1000000, true);
    if (flights === undefined) next.flights = t('profile.numberInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSave({
        ...edit,
        flyingSince: year ?? null,
        weightKg: weight ?? null,
        totalHours: Math.round((hours ?? 0) * 10) / 10,
        totalFlights: flights ?? 0,
        ...(text.licence.trim() !== licence ? { licence: text.licence } : {}),
      });
    } catch (e) {
      Alert.alert(
        e instanceof Error && e.message === 'licence'
          ? t('profile.licenceError')
          : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  }

  // An older level (student, P1, tandem) stays shown until changed.
  const levels: string[] = [
    ...(edit.pilotLevel && !(PILOT_LEVELS as readonly string[]).includes(edit.pilotLevel)
      ? [edit.pilotLevel]
      : []),
    ...PILOT_LEVELS,
  ];
  const countries: string[] = [
    ...(edit.country && !(PROFILE_COUNTRIES as readonly string[]).includes(edit.country)
      ? [edit.country]
      : []),
    ...PROFILE_COUNTRIES,
  ];

  return (
    <Modal
      visible={section !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={[s.sheetBar, { borderColor: c.border }]}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={s.barButton}>
            <Text style={[s.barText, { color: c.primary }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={[s.barTitle, { color: c.text }]} numberOfLines={1}>
            {section ? t(`profile.sections.${section}`) : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void save()}
            disabled={busy}
            hitSlop={8}
            style={s.barButton}
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={[s.barText, { color: c.primary, fontWeight: '800' }]}>
                {t('profile.save')}
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          {section === 'personal' ? (
            <>
              <Field
                label={t('profile.displayName')}
                value={edit.displayName}
                onChangeText={(v) => set('displayName', v)}
                maxLength={40}
                error={errors.displayName}
              />
              <Field
                label={t('profile.fullName')}
                value={edit.fullName}
                onChangeText={(v) => set('fullName', v)}
                maxLength={100}
                autoComplete="name"
              />
              <Chips
                label={t('profile.country')}
                options={[
                  { value: null, label: '—' },
                  ...countries.map((code) => ({ value: code, label: `${flag(code)} ${code}` })),
                ]}
                value={edit.country}
                onChange={(v) => set('country', v)}
              />
              <Field
                label={t('profile.city')}
                value={edit.city}
                onChangeText={(v) => set('city', v)}
                maxLength={80}
              />
              <Field
                label={t('profile.bio')}
                value={edit.bio}
                onChangeText={(v) => set('bio', v)}
                maxLength={500}
                multiline
              />
            </>
          ) : null}

          {section === 'flying' ? (
            <>
              <Chips
                label={t('profile.level')}
                options={[
                  { value: null, label: t('profile.levelNone') },
                  ...levels.map((l) => ({ value: l, label: l.toUpperCase() })),
                ]}
                value={edit.pilotLevel}
                onChange={(v) =>
                  setEdit((e) => ({
                    ...e,
                    pilotLevel: v,
                    // A target that is no longer above the new level is dropped.
                    ...(e.trainingLevel && !trainingLevelOptions(v).includes(e.trainingLevel)
                      ? { trainingLevel: null }
                      : {}),
                  }))
                }
              />
              {isStudent ? (
                trainingLevelOptions(edit.pilotLevel).length ? (
                  <Chips
                    label={t('profile.trainingLevel')}
                    options={[
                      { value: null, label: t('profile.levelNone') },
                      ...trainingLevelOptions(edit.pilotLevel).map((l) => ({
                        value: l,
                        label: l.toUpperCase(),
                      })),
                    ]}
                    value={edit.trainingLevel ?? null}
                    onChange={(v) => set('trainingLevel', v)}
                  />
                ) : (
                  <Body muted>{t('profile.trainingLevelTop')}</Body>
                )
              ) : null}
              <Chips
                label={t('profile.licenceBody')}
                options={[
                  { value: null, label: '—' },
                  ...LICENCE_BODIES.map((b) => ({
                    value: b,
                    label: t(`profile.licenceBodies.${b}` as MessageKey),
                  })),
                ]}
                value={edit.licenceBody}
                onChange={(v) => set('licenceBody', v)}
              />
              <Field
                label={t('profile.licence')}
                value={text.licence}
                onChangeText={setTextField('licence')}
                maxLength={40}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Body muted>{t('profile.licenceHelp')}</Body>
              <Field
                label={t('profile.flyingSince')}
                value={text.since}
                onChangeText={setTextField('since')}
                keyboardType="number-pad"
                maxLength={4}
                error={errors.flyingSince}
              />
              <Field
                label={t('profile.homeSite')}
                value={edit.homeSite}
                onChangeText={(v) => set('homeSite', v)}
                maxLength={120}
              />
              <Field
                label={t('profile.wings')}
                value={edit.wings}
                onChangeText={(v) => set('wings', v)}
                maxLength={200}
              />
              <Field
                label={t('profile.weight')}
                value={text.weight}
                onChangeText={setTextField('weight')}
                keyboardType="number-pad"
                maxLength={3}
                error={errors.weight}
              />
              <Body muted>{t('profile.weightHelp')}</Body>
              <View style={s.pair}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('profile.totalHours')}
                    value={text.hours}
                    onChangeText={setTextField('hours')}
                    keyboardType="decimal-pad"
                    maxLength={8}
                    error={errors.hours}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('profile.totalFlights')}
                    value={text.flights}
                    onChangeText={setTextField('flights')}
                    keyboardType="number-pad"
                    maxLength={7}
                    error={errors.flights}
                  />
                </View>
              </View>
              <Body muted>{t('profile.totalsHelp')}</Body>
            </>
          ) : null}

          {section === 'privacy' ? (
            <>
              <Body muted>{t('profile.privacyLead')}</Body>
              {PRIVACY_FIELDS.map((f) => (
                <Segmented
                  key={f}
                  label={t(`profile.privacyFields.${f}`)}
                  options={VISIBILITIES.map((v) => ({
                    value: v,
                    label: t(`profile.visibility.${v}`),
                  }))}
                  value={edit.privacy[f]}
                  onChange={(v) => set('privacy', { ...edit.privacy, [f]: v })}
                />
              ))}
            </>
          ) : null}

          {section === 'units' ? (
            <>
              <Segmented
                label={t('profile.sections.units')}
                options={UNIT_SYSTEMS.map((u) => ({
                  value: u,
                  label: t(`profile.unitSystem.${u}`),
                }))}
                value={edit.units.system}
                onChange={(v) => set('units', { ...edit.units, system: v })}
              />
              <Segmented
                label={t('profile.speed')}
                options={SPEED_UNITS.map((u) => ({ value: u, label: speedLabel(u) }))}
                value={edit.units.speed}
                onChange={(v) => set('units', { ...edit.units, speed: v })}
              />
              <Body muted>{t('profile.unitsHelp')}</Body>
            </>
          ) : null}
          <Button label={t('profile.save')} busy={busy} onPress={() => void save()} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  const c = useTheme();
  return (
    <Card style={s.tile}>
      <Text style={[s.tileValue, { color: c.text }]}>{value}</Text>
      <Text style={[s.tileLabel, { color: c.muted }]}>{label}</Text>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 4, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarWrap: { minWidth: 72, minHeight: 72 },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: { fontSize: 15 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  sectionEdit: { fontSize: 16, fontWeight: '700' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barButton: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  barText: { fontSize: 17 },
  barTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  pair: { flexDirection: 'row', gap: 10 },
  errorDetail: { fontSize: 12, textAlign: 'center' },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 30, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center' },
  tileValue: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
