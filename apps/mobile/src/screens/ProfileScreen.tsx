import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
  deleteMyAccount,
  loadMyProfile,
  saveLocale,
  saveMyProfile,
  type MyProfile,
  type ProfileEdit,
} from '../profile';
import { VarioAudio } from '../tracker/vario-audio';
import { VOLUME_LEVEL } from '../tracker/vario-settings';
import { useVarioSettings } from '../tracker/vario-settings-store';
import { Badge, Body, Button, Card, Chips, Field, Link, Segmented, Title, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { VarioSettingsScreen } from './VarioSettingsScreen';

function levelLabel(level: string) {
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
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [vario, setVario] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const settings = useVarioSettings();
  const audio = useRef(new VarioAudio());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await loadMyProfile(userId));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
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
        {failed ? (
          <>
            <Body muted>{t('common.offline')}</Body>
            <Button label={t('profile.retry')} kind="secondary" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const strongest = profile.roles.filter(
    (r) => r !== 'member' || !profile.roles.some((x) => x === 'pilot' || x === 'student_pilot'),
  );
  const showInstructor = profile.isInstructor && !profile.roles.includes('instructor');
  const years =
    profile.flyingSince != null
      ? Math.max(0, new Date().getFullYear() - profile.flyingSince)
      : null;

  return (
    <ScrollView
      contentContainerStyle={s.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Card style={s.header}>
        {profile.avatarUrl ? (
          <Image
            source={{ uri: profile.avatarUrl }}
            style={s.avatar}
            accessibilityLabel={t('profile.photo')}
          />
        ) : (
          <View style={[s.avatar, s.initials, { backgroundColor: c.primary }]}>
            <Text style={[s.initialsText, { color: c.primaryText }]}>
              {profile.displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Title>{profile.displayName}</Title>
          {profile.fullName ? <Body muted>{profile.fullName}</Body> : null}
          {session.user.email ? <Body muted>{session.user.email}</Body> : null}
        </View>
      </Card>
      <View style={s.badges}>
        {profile.pilotLevel ? <Badge label={levelLabel(profile.pilotLevel)} tone="strong" /> : null}
        {showInstructor ? <Badge label={t('profile.roles.instructor')} tone="strong" /> : null}
        {strongest.map((r) => (
          <Badge key={r} label={t(`profile.roles.${r}` as MessageKey)} />
        ))}
      </View>

      <View style={s.tiles}>
        <Tile
          value={profile.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          label={t('flights.totalHours')}
        />
        <Tile value={String(profile.totalFlights)} label={t('flights.totalFlights')} />
        <Tile value={years != null ? String(years) : '—'} label={t('profile.yearsFlying')} />
      </View>

      <Card>
        <Row
          label={t('profile.level')}
          value={profile.pilotLevel ? levelLabel(profile.pilotLevel) : '—'}
        />
        <Row
          label={t('profile.licenceBody')}
          value={
            profile.licenceBody
              ? t(`profile.licenceBodies.${profile.licenceBody}` as MessageKey)
              : '—'
          }
        />
        <Row label={t('profile.homeSite')} value={profile.homeSite || '—'} />
        <Row label={t('profile.city')} value={profile.city || '—'} />
        <Row
          label={t('profile.memberSince')}
          value={new Date(profile.createdAt).toLocaleDateString(
            locale === 'tr' ? 'tr-TR' : 'en-GB',
            { month: 'long', year: 'numeric' },
          )}
        />
        {profile.bio ? <Body>{profile.bio}</Body> : null}
      </Card>
      <Button label={t('profile.edit')} onPress={() => setEditing(true)} />

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
        visible={editing}
        profile={profile}
        onClose={() => setEditing(false)}
        onSave={async (edit) => {
          await saveMyProfile(userId, edit);
          setEditing(false);
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

function EditProfile({
  visible,
  profile,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile: MyProfile;
  onClose: () => void;
  onSave: (edit: ProfileEdit) => Promise<void>;
}) {
  const c = useTheme();
  const initial = (): ProfileEdit => ({
    displayName: profile.displayName,
    fullName: profile.fullName,
    city: profile.city,
    homeSite: profile.homeSite,
    pilotLevel: profile.pilotLevel === 'instructor' ? null : profile.pilotLevel,
    isInstructor: profile.isInstructor,
    flyingSince: profile.flyingSince,
    bio: profile.bio,
    licenceBody: profile.licenceBody,
  });
  const [edit, setEdit] = useState<ProfileEdit>(initial);
  const [since, setSince] = useState(profile.flyingSince?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setEdit(initial());
      setSince(profile.flyingSince?.toString() ?? '');
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [visible]);

  const set = <K extends keyof ProfileEdit>(key: K, value: ProfileEdit[K]) =>
    setEdit((e) => ({ ...e, [key]: value }));

  async function save() {
    const next: Record<string, string> = {};
    const name = edit.displayName.trim();
    if (name.length < 2 || name.length > 40) next.displayName = t('profile.nameInvalid');
    const year = since.trim() === '' ? null : Number(since);
    if (
      year !== null &&
      (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear())
    )
      next.flyingSince = t('profile.yearInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSave({ ...edit, flyingSince: year });
    } catch {
      Alert.alert(t('common.error'));
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <Title>{t('profile.edit')}</Title>
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
            label={t('profile.level')}
            options={[
              { value: null, label: t('profile.levelNone') },
              ...levels.map((l) => ({ value: l, label: l.toUpperCase() })),
            ]}
            value={edit.pilotLevel}
            onChange={(v) => set('pilotLevel', v)}
          />
          <Toggle
            label={t('profile.isInstructor')}
            value={edit.isInstructor}
            onChange={(v) => set('isInstructor', v)}
          />
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
            label={t('profile.flyingSince')}
            value={since}
            onChangeText={setSince}
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
          <Body muted>{t('profile.webOnly')}</Body>
          <Button label={t('profile.save')} busy={busy} onPress={() => void save()} />
          <Button label={t('common.cancel')} kind="secondary" onPress={onClose} />
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
