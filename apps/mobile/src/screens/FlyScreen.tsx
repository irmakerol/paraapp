import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Barometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n';
import { duration, signed } from '../format';
import { BaroVario, type LiveState } from '../tracker/live';
import { VarioAudio } from '../tracker/vario-audio';
import { startRecording, stopRecording, subscribeRecorder } from '../tracker/recorder';
import { updateFlight } from '../tracker/flights';
import { uploadPending } from '../upload';
import { Body, Button, Card, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';

const SOUND_KEY = 'settings:sound';
const AWAKE_KEY = 'settings:awake';

export function FlyScreen() {
  const c = useTheme();
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState<LiveState | null>(null);
  const [baroClimb, setBaroClimb] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const [awake, setAwake] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef(new VarioAudio());
  const baro = useRef(new BaroVario());

  useEffect(() => {
    void AsyncStorage.multiGet([SOUND_KEY, AWAKE_KEY]).then(([s, a]) => {
      if (s?.[1]) setSound(s[1] === '1');
      if (a?.[1]) setAwake(a[1] === '1');
    });
    return subscribeRecorder((event) => {
      if (event.type === 'state') {
        setRecording(event.recording);
        setLive(event.live ? { ...event.live } : null);
      } else if (event.type === 'saved') {
        const id = event.flight.id;
        Alert.alert(t('fly.saved'), t('fly.totalsQuestion'), [
          {
            text: t('common.no'),
            style: 'cancel',
            onPress: () => void updateFlight(id, { addToTotals: false }).then(uploadPending),
          },
          {
            text: t('common.yes'),
            onPress: () => void updateFlight(id, { addToTotals: true }).then(uploadPending),
          },
        ]);
      } else {
        Alert.alert(t('fly.tooShort'));
      }
    });
  }, []);

  // Barometer vario while recording (iOS gives a smoothed relative altitude).
  useEffect(() => {
    if (!recording) return;
    Barometer.setUpdateInterval(100);
    baro.current.reset();
    const sub = Barometer.addListener((m) => {
      if (typeof m.relativeAltitude !== 'number') return;
      setBaroClimb(baro.current.push(Date.now(), m.relativeAltitude));
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
      setBaroClimb(null);
    };
  }, [recording]);

  const climb = baroClimb ?? live?.gpsVario ?? null;

  useEffect(() => {
    audio.current.update(climb);
  }, [climb]);

  useEffect(() => {
    const a = audio.current;
    if (recording && sound) void a.start();
    else a.stop();
    return () => a.stop();
  }, [recording, sound]);

  useEffect(() => {
    if (recording && awake) void activateKeepAwakeAsync('recorder');
    else deactivateKeepAwake('recorder');
  }, [recording, awake]);

  async function start() {
    setBusy(true);
    try {
      const result = await startRecording();
      if (result === 'denied') {
        Alert.alert(t('fly.permissionTitle'), t('fly.permissionBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('fly.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
      }
      setWarning(result === 'foregroundOnly' ? t('fly.onlyWhileUsing') : null);
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    Alert.alert(t('fly.stopConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fly.stop'),
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void stopRecording().finally(() => setBusy(false));
        },
      },
    ]);
  }

  const last = live?.last ?? null;
  const phase = !last ? t('fly.acquiring') : t(`fly.${live?.phase ?? 'waiting'}`);
  const flightTime =
    live?.takeoffAt != null ? duration(((live.landedAt ?? now) - live.takeoffAt) / 1000) : '—';
  const climbColor =
    climb === null ? c.text : climb >= 0.2 ? c.climb : climb <= -1.5 ? c.sink : c.text;

  return (
    <ScrollView contentContainerStyle={s.page}>
      {recording ? (
        <>
          <Text style={[s.phase, { color: c.muted }]} accessibilityLiveRegion="polite">
            {phase}
            {last?.acc != null ? `  ·  ${t('fly.gpsAccuracy', { m: Math.round(last.acc) })}` : ''}
          </Text>
          <Card style={s.bigCard}>
            <Text style={[s.label, { color: c.muted }]}>{t('fly.vario')}</Text>
            <Text
              style={[s.huge, { color: climbColor }]}
              accessibilityLabel={`${t('fly.vario')} ${climb?.toFixed(1) ?? '—'} m/s`}
            >
              {climb === null ? '—' : signed(climb)}
              <Text style={s.unit}> m/s</Text>
            </Text>
          </Card>
          <View style={s.grid}>
            <Stat
              label={t('fly.altitude')}
              value={last ? `${Math.round(last.alt)}` : '—'}
              unit="m"
            />
            <Stat
              label={t('fly.agl')}
              value={last && live?.takeoffAlt != null ? signed(last.alt - live.takeoffAlt, 0) : '—'}
              unit="m"
            />
            <Stat
              label={t('fly.speed')}
              value={live?.groundSpeed != null ? `${Math.round(live.groundSpeed * 3.6)}` : '—'}
              unit="km/h"
            />
            <Stat
              label={t('fly.glide')}
              value={live?.glide != null ? live.glide.toFixed(1) : '—'}
              unit=":1"
            />
            <Stat label={t('fly.time')} value={flightTime} unit="" wide />
          </View>
          {warning ? <Body muted>{warning}</Body> : null}
          <Toggle
            label={t('fly.sound')}
            value={sound}
            onChange={(v) => {
              setSound(v);
              void AsyncStorage.setItem(SOUND_KEY, v ? '1' : '0');
            }}
          />
          <Toggle
            label={t('fly.keepAwake')}
            value={awake}
            onChange={(v) => {
              setAwake(v);
              void AsyncStorage.setItem(AWAKE_KEY, v ? '1' : '0');
            }}
          />
          <Button label={t('fly.stop')} kind="danger" busy={busy} onPress={stop} />
        </>
      ) : (
        <>
          <Button label={t('fly.start')} busy={busy} onPress={() => void start()} style={s.start} />
          <Body muted>{t('fly.hint')}</Body>
          <Toggle
            label={t('fly.sound')}
            value={sound}
            onChange={(v) => {
              setSound(v);
              void AsyncStorage.setItem(SOUND_KEY, v ? '1' : '0');
            }}
          />
          <Toggle
            label={t('fly.keepAwake')}
            value={awake}
            onChange={(v) => {
              setAwake(v);
              void AsyncStorage.setItem(AWAKE_KEY, v ? '1' : '0');
            }}
          />
        </>
      )}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  unit,
  wide = false,
}: {
  label: string;
  value: string;
  unit: string;
  wide?: boolean;
}) {
  const c = useTheme();
  return (
    <Card style={[s.stat, wide && s.wide]}>
      <Text style={[s.label, { color: c.muted }]}>{label}</Text>
      <Text style={[s.value, { color: c.text }]} accessibilityLabel={`${label} ${value} ${unit}`}>
        {value}
        {unit ? <Text style={s.unitSmall}> {unit}</Text> : null}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 4 },
  phase: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  bigCard: { alignItems: 'center', paddingVertical: 12 },
  huge: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 22, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '48.5%', marginVertical: 4 },
  wide: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600' },
  value: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unitSmall: { fontSize: 16, fontWeight: '500' },
  start: { minHeight: 96, marginVertical: 24 },
});
