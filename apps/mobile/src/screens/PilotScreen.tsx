import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, type MessageKey } from '../i18n';
import { loadPilot, setFollowing, type PilotCard } from '../pilots';
import { startDirectChat } from '../chats';
import { Badge, Body, Button, Card } from '../ui/kit';
import { BackBar, Fact, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';
import { levelLabel } from './ProfileScreen';

/** Another pilot's public profile with follow and message, as on the website's pilot page. */
export function PilotScreen({
  id,
  viewerId,
  onBack,
  onChat,
}: {
  id: string;
  viewerId: string | null;
  onBack: () => void;
  onChat: (chatId: string) => void;
}) {
  const c = useTheme();
  const [pilot, setPilot] = useState<PilotCard | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPilot(await loadPilot(id, viewerId));
    } catch {
      setPilot(null);
    }
  }, [id, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!pilot)
    return (
      <View style={screenStyles.page}>
        <BackBar onBack={onBack} />
        {pilot === undefined ? (
          <ActivityIndicator />
        ) : (
          <Body muted>{t('pilots.privateProfile')}</Body>
        )}
      </View>
    );

  const self = viewerId === pilot.id;
  const follow = async () => {
    if (!viewerId) return;
    setBusy(true);
    const next = !pilot.isFollowing;
    if (await setFollowing(viewerId, pilot.id, next))
      setPilot({ ...pilot, isFollowing: next, followers: pilot.followers + (next ? 1 : -1) });
    setBusy(false);
  };
  const chat = async () => {
    setBusy(true);
    setMessage(null);
    try {
      onChat(await startDirectChat(pilot.id));
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

  const shownRoles = pilot.roles.filter(
    (r) => r !== 'member' || !pilot.roles.some((x) => x === 'pilot' || x === 'student_pilot'),
  );
  return (
    <ScrollView contentContainerStyle={screenStyles.page}>
      <BackBar onBack={onBack} />
      <View style={s.header}>
        {pilot.avatarUrl ? (
          <Image source={{ uri: pilot.avatarUrl }} style={s.avatar} />
        ) : (
          <View
            style={[s.avatar, s.placeholder, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={[s.initial, { color: c.text }]}>
              {pilot.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={[s.name, { color: c.text }]}>
            {pilot.name}
          </Text>
          <Text style={{ color: c.muted, fontSize: 15 }}>
            {t('pilots.followers', { count: pilot.followers })}
          </Text>
        </View>
      </View>
      <View style={s.badges}>
        {pilot.pilotLevel ? <Badge label={levelLabel(pilot.pilotLevel)} tone="strong" /> : null}
        {pilot.isInstructor && !pilot.roles.includes('instructor') ? (
          <Badge label={t('profile.roles.instructor')} tone="strong" />
        ) : null}
        {shownRoles.map((r) => (
          <Badge key={r} label={t(`profile.roles.${r}` as MessageKey)} />
        ))}
      </View>
      {viewerId && !self ? (
        <View style={s.actions}>
          <Button
            label={pilot.isFollowing ? t('pilots.unfollow') : t('pilots.follow')}
            kind={pilot.isFollowing ? 'primary' : 'secondary'}
            disabled={busy || pilot.blocked}
            onPress={() => void follow()}
            style={{ flex: 1 }}
          />
          <Button
            label={t('pilots.message')}
            disabled={busy || pilot.blocked}
            onPress={() => void chat()}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {message ? <Body muted>{message}</Body> : null}
      {pilot.bio ? <Body>{pilot.bio}</Body> : null}
      <Card>
        {pilot.totalHours != null ? (
          <Fact label={t('pilots.totalHours')} value={String(pilot.totalHours)} />
        ) : null}
        {pilot.totalFlights != null ? (
          <Fact label={t('pilots.totalFlights')} value={String(pilot.totalFlights)} />
        ) : null}
        {pilot.flyingSince != null ? (
          <Fact
            label={t('pilots.yearsFlyingStat')}
            value={t('pilots.flyingSince', { year: pilot.flyingSince })}
          />
        ) : pilot.yearsFlying != null ? (
          <Fact label={t('pilots.yearsFlyingStat')} value={String(pilot.yearsFlying)} />
        ) : null}
        {pilot.homeSite ? <Fact label={t('profile.homeSite')} value={pilot.homeSite} /> : null}
        {pilot.wings ? <Fact label={t('pilots.wingsLabel')} value={pilot.wings} /> : null}
        {pilot.city || pilot.country ? (
          <Fact label="📍" value={[pilot.city, pilot.country].filter(Boolean).join(', ')} />
        ) : null}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  placeholder: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 34, fontWeight: '800' },
  name: { fontSize: 26, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  actions: { flexDirection: 'row', gap: 10 },
});
